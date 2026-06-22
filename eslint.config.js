import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // UI yardımcı dosyaları bileşenlerle birlikte varyant sabitleri de dışa aktarır.
      'react-refresh/only-export-components': 'off',
      // İlk tarayıcı verisini effect içinde eşitlemek bu istemci uygulamasında kasıtlıdır.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
