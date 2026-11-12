// base/anexos.jsx
// Código movido do App.jsx tal como estava (divisão do App.jsx, ver docs/ESTADO.md).
// Não mudar lógica aqui sem seguir as regras desse ficheiro.
import { uid } from './utilidades';
import { supabase } from '../supabaseClient';
import * as tus from 'tus-js-client';
import { T } from './tema';
import { useState, useEffect } from 'react';

/* Lê um ficheiro (imagem ou PDF) escolhido pelo utilizador e devolve uma
   Promise com um data URL em base64, pronto a guardar diretamente no
   registo do exercício (mesma abordagem usada para o emblema do clube). */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/* Fotografia de jogador. Ao contrário dos anexos dos exercícios, a foto é
   redimensionada no browser ANTES de ser guardada: o Realtime do Supabase
   corta payloads acima de ~1 MB e uma foto tirada com o telemóvel tem
   facilmente 4-8 MB. 640px no lado maior, JPEG a 82%, dá uma foto nítida
   na ficha impressa e fica quase sempre abaixo dos 120 KB. */
export const PHOTO_MAX_SIDE = 640;

export function fileToPhotoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      img.onload = () => {
        const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        try { resolve(canvas.toDataURL('image/jpeg', 0.82)); }
        catch (e) { resolve(reader.result); } // fallback: guarda o original
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ANEXOS NO STORAGE (versão comercial, ponto 4).

   Até aqui, os anexos dos Exercícios, do Diário e os ficheiros carregados
   na Sala de Vídeo (Canal e Apresentações) iam em base64 DENTRO do
   registo: um vídeo de 60 MB ficava com ~80 MB numa linha da tabela,
   com tempo limite ao gravar e descarregado inteiro sempre que alguém
   abria o separador. Agora o ficheiro vai para o Storage e o registo
   guarda só a referência.

   - Sala de Vídeo e Exercícios → bucket "anexos" (leitura por link
     longo e aleatório, como os clipes da Análise). O Portal do Atleta
     mostra o Canal sem sessão, por isso precisa de um link direto. O
     link fica em `dataUrl`, o mesmo campo de sempre: todo o código que
     mostra, descarrega ou imprime continua igual.
   - Diário → bucket "anexos-privados" (pode ter documentos sensíveis de
     atletas). O registo não guarda link nenhum, só o caminho; a app pede
     um link temporário quando precisa de mostrar (ver `useUrlAnexo`).

   COMPATIBILIDADE: o que já existe em base64 continua a funcionar tal e
   qual. E se o envio para o Storage falhar (sem rede, bucket ainda por
   criar), cai para o comportamento antigo (base64) em vez de perder o
   anexo. */
export const BUCKET_ANEXOS = 'anexos';

export const BUCKET_ANEXOS_PRIVADOS = 'anexos-privados';

export const ENVIO_SIMPLES_MAX = 6 * 1024 * 1024; // acima disto, envio retomável (tus), como recomenda a Supabase

export function idAleatorioLongo() {
  try { if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID(); } catch (e) { /* segue */ }
  return `${uid()}${uid()}${uid()}${uid()}`;
}

export function nomeFicheiroSeguro(nome) {
  return String(nome || 'ficheiro')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.\-]/g, '_')
    .slice(-80);
}

export async function enviarPorTusParaBucket(file, bucket, caminho, contentType) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('sem sessão');
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').replace('.supabase.co', '.storage.supabase.co');
  await new Promise((resolve, reject) => {
    const envio = new tus.Upload(file, {
      endpoint: `${base}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: { 'x-upsert': 'false' },
      onBeforeRequest: async (req) => {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s?.access_token) req.setHeader('Authorization', `Bearer ${s.access_token}`);
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: bucket, objectName: caminho, contentType, cacheControl: '3600' },
      chunkSize: 6 * 1024 * 1024,
      onError: reject,
      onSuccess: () => resolve(),
    });
    envio.start();
  });
}

export async function enviarAnexoParaStorage(file, { pasta, privado = false }) {
  const equipa = T.equipaId;
  if (!equipa) throw new Error('equipa desconhecida');
  const bucket = privado ? BUCKET_ANEXOS_PRIVADOS : BUCKET_ANEXOS;
  const caminho = `${equipa}/${pasta}/${idAleatorioLongo()}-${nomeFicheiroSeguro(file.name)}`;
  const contentType = file.type || 'application/octet-stream';
  if (file.size > ENVIO_SIMPLES_MAX) {
    await enviarPorTusParaBucket(file, bucket, caminho, contentType);
  } else {
    const { error } = await supabase.storage.from(bucket).upload(caminho, file, { contentType, upsert: false, cacheControl: '3600' });
    if (error) throw error;
  }
  return { bucket, caminho };
}

/* Devolve { campos, emBase64 }: `campos` entra diretamente no registo
   (dataUrl e/ou storagePath + bucket). `emBase64` diz se caiu para o
   comportamento antigo (serve só para avisos). */
export async function ficheiroParaAnexo(file, { pasta, privado = false }) {
  try {
    const { bucket, caminho } = await enviarAnexoParaStorage(file, { pasta, privado });
    if (privado) return { campos: { storagePath: caminho, bucket }, emBase64: false };
    const { data } = supabase.storage.from(bucket).getPublicUrl(caminho);
    return { campos: { dataUrl: data.publicUrl, storagePath: caminho, bucket }, emBase64: false };
  } catch (e) {
    console.warn('[anexos] Envio para o Storage falhou; fica guardado como antes (base64).', e);
    return { campos: { dataUrl: await fileToDataUrl(file) }, emBase64: true };
  }
}

/* Link temporário para um anexo privado (Diário). Guardado em memória
   por 50 minutos para não pedir um novo a cada desenho do ecrã. */
export const LINKS_ANEXOS = new Map();

export async function urlAssinadaDoAnexo(anexo) {
  if (!anexo || !anexo.storagePath || !anexo.bucket) return '';
  const chave = `${anexo.bucket}/${anexo.storagePath}`;
  const guardado = LINKS_ANEXOS.get(chave);
  if (guardado && guardado.expira > Date.now()) return guardado.url;
  const { data, error } = await supabase.storage.from(anexo.bucket).createSignedUrl(anexo.storagePath, 3600);
  if (error || !data || !data.signedUrl) return '';
  LINKS_ANEXOS.set(chave, { url: data.signedUrl, expira: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

/* O link a usar para mostrar um anexo: o `dataUrl` quando existe (base64
   antigo ou link direto), senão um link temporário pedido ao Storage. */
export function useUrlAnexo(anexo) {
  const direto = (anexo && anexo.dataUrl) || '';
  const [assinado, setAssinado] = useState('');
  const caminho = anexo && !direto ? anexo.storagePath : null;
  const bucket = anexo && anexo.bucket;
  useEffect(() => {
    if (!caminho) { setAssinado(''); return undefined; }
    let vivo = true;
    urlAssinadaDoAnexo({ storagePath: caminho, bucket }).then(u => { if (vivo) setAssinado(u); });
    return () => { vivo = false; };
  }, [caminho, bucket]);
  return direto || assinado;
}

export function UrlAnexo({ anexo, children }) {
  return children(useUrlAnexo(anexo));
}

/* Link de descarga: nos ficheiros do Storage, `?download=` faz o browser
   guardar o ficheiro com o nome certo em vez de sair da app para o abrir
   (o atributo `download` não funciona entre domínios). Base64 fica igual. */
export function hrefDescarga(url, nome) {
  if (!url || !/\/storage\/v1\/object\/(public|sign)\//.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(nome || '')}`;
}

