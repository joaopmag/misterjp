// atleta/apiMeusVideos.js (23/11): a API de "Os meus vídeos" do Portal,
// à parte de salaDados.js para o cacifo não carregar o código do MP4
// (videoJunto/planoDesenhos). Só a usam ecrãs que já carregam à parte.
import { supabase } from '../supabaseClient';
import { apagarMp4DoVideo, pedirMp4DoVideo, urlDoServicoVideo } from '../media/videoJunto';
import { lerJsonSala } from './salaDados';

/* OS MEUS VÍDEOS no servidor (ver os_meus_videos.sql): ler, guardar,
   partilhar, apagar e o MP4 feito no servidor. Cada função devolve os
   dados ou lança um erro. Usada pela Sala (SalaVideo.jsx, via
   CompilacoesAtleta) e pelo acesso depois da saída (VideosAposSaida.jsx). */
export function criarApiMeusVideos(code, teamId) {
  return {
    ler: async () => {
      const { data, error } = await supabase.rpc('checkin_meus_videos', { p_code: code, p_team: teamId });
      if (error) throw error;
      const d = lerJsonSala(data);
      if (!d) throw new Error('codigo_invalido');
      return (d.videos || []).filter(Boolean);
    },
    guardar: async ({ id, nome, ids }) => {
      const { data, error } = await supabase.rpc('checkin_video_guardar', { p_code: code, p_team: teamId, p_id: id || '', p_nome: nome, p_ids: ids });
      if (error) throw error;
      const d = lerJsonSala(data);
      if (!d || !d.ok) throw new Error((d && d.erro) || 'erro');
      return d.video;
    },
    partilhar: async (id) => {
      const { data, error } = await supabase.rpc('checkin_video_partilhar', { p_code: code, p_team: teamId, p_id: id });
      if (error) throw error;
      const d = lerJsonSala(data);
      if (!d || !d.ok) throw new Error((d && d.erro) || 'erro');
      return d.codigo;
    },
    apagar: async (id) => {
      const { data, error } = await supabase.rpc('checkin_video_apagar', { p_code: code, p_team: teamId, p_id: id });
      if (error) throw error;
      const d = lerJsonSala(data);
      if (d && !d.ok && d.erro !== 'video_invalido') throw new Error(d.erro || 'erro');
    },
    /* MP4 feito no servidor (ver media/videoJunto.js). Sem o serviço de
       vídeo configurado, não há: o Descarregar grava no browser. */
    ...(urlDoServicoVideo() ? {
      ficheiros: async () => {
        const { data, error } = await supabase.rpc('checkin_video_ficheiros', { p_code: code, p_team: teamId });
        if (error) throw error;
        const d = lerJsonSala(data);
        if (!d || !d.ok) throw new Error((d && d.erro) || 'erro');
        return (d.videos || []).filter(Boolean);
      },
      prepararMp4: (id) => pedirMp4DoVideo(code, teamId, id),
      apagarMp4: (id) => apagarMp4DoVideo(code, teamId, id),
    } : {}),
  };
}
