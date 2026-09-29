// ESLint flat config (CONVENTIONS 1·3장, ROADMAP 1단계 "레이어 경계 규칙")
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { flatConfigs as importXFlatConfigs } from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { config as defineConfig, configs as tsConfigs } from 'typescript-eslint';

const NO_ENUM = {
  selector: 'TSEnumDeclaration',
  message: 'enum 대신 문자열 리터럴 유니온을 쓴다 (CONVENTIONS 4장)',
};

// features 간 import는 features/<name>/index.ts(public API)만 허용
const FEATURES_INTERNAL = {
  group: ['@/features/*/*'],
  message: '다른 feature는 index.ts(public API)로만 import한다 (CONVENTIONS 3장)',
};

const restrictedImports = (...patterns) => [
  'error',
  { patterns: [FEATURES_INTERNAL, ...patterns] },
];

export default defineConfig(
  { ignores: ['dist', 'coverage', 'node_modules', 'reports', 'public/mockServiceWorker.js'] },
  js.configs.recommended,
  ...tsConfigs.strictTypeChecked,
  ...tsConfigs.stylisticTypeChecked,
  importXFlatConfigs.recommended,
  importXFlatConfigs.typescript,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser },
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: ['tsconfig.app.json', 'tsconfig.node.json'],
          noWarnOnMultipleProjects: true,
        }),
      ],
    },
    rules: {
      'no-restricted-syntax': ['error', NO_ENUM],
      'no-restricted-imports': restrictedImports(),
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      // 모듈 해석은 TS가 검사한다. @/ alias용 resolver를 따로 두지 않는다
      'import-x/no-unresolved': 'off',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },
  {
    files: ['vite.config.ts', 'playwright.config.ts', 'src/mocks/sse-server.ts', 'e2e/**'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // game/은 React 무관 순수 TS (ARCHITECTURE 1장)
    files: ['src/game/**'],
    rules: {
      'no-restricted-imports': restrictedImports({
        group: [
          'react',
          'react-dom',
          'react-dom/*',
          '@/features/**',
          '@/pages/**',
          '@/app/**',
          '@/shared/**',
        ],
        message: 'game/은 React·UI 레이어를 import하지 않는다 (ARCHITECTURE 1장)',
      }),
    },
  },
  {
    // domain/은 같은 폴더 상대 import 외 전부 금지 (CONVENTIONS 3장)
    files: ['src/domain/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        NO_ENUM,
        {
          selector: 'ImportDeclaration[source.value!=/^\\.\\//]',
          message: 'domain/은 같은 폴더의 상대 import(./*)만 허용한다 (CONVENTIONS 3장)',
        },
      ],
    },
  },
  {
    // transport/는 store에 쓰기만 하고 features·pages·app을 알지 못한다
    files: ['src/transport/**'],
    rules: {
      'no-restricted-imports': restrictedImports({
        group: ['@/features/**', '@/pages/**', '@/app/**'],
        message: 'transport/는 features·pages·app을 import하지 않는다 (CONVENTIONS 3장)',
      }),
    },
  },
  {
    // 테스트·Mock은 경계 규칙 해제 (enum 금지는 유지)
    files: ['**/*.test.*', 'src/mocks/**', 'src/test/**'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': ['error', NO_ENUM],
    },
  },
  { files: ['**/*.js'], ...tsConfigs.disableTypeChecked },
  prettier,
);
