// VERIFICADOR DE SEGURANÇA (passo 0 da divisão do App.jsx).
// Não é um "verificador de estilo": só acusa o que REBENTA a app quando
// alguém abre um ecrã — sobretudo nomes usados num ficheiro sem estarem
// definidos ou importados lá (o risco n.º 1 ao mudar código de ficheiro:
// a app compila na mesma e só falha ao abrir esse ecrã).
// Corre com:  npm run verificar   (tem de dar 0 problemas)
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: { react, 'react-hooks': reactHooks },
    // os comentários "eslint-disable ..." já existentes no código não são problemas
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    settings: { react: { version: '18' } },
    rules: {
      'no-undef': 'error',               // nome usado sem existir neste ficheiro
      'no-import-assign': 'error',       // alterar uma variável importada (rebenta ao correr)
      'react/jsx-no-undef': 'error',     // componente <Xpto /> sem import
      'react/jsx-uses-vars': 'error',    // (necessário para o no-undef perceber o JSX)
      'react/jsx-uses-react': 'error',
      'no-dupe-keys': 'off',             // já existiam; não rebentam a app
    },
  },
  {
    files: ['api/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-undef': 'error' },
  },
];
