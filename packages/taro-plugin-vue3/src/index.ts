import { chalk } from '@tarojs/helper'
import type { IPluginContext } from '@tarojs/service'

import { modifyH5WebpackChain } from './webpack.h5'
import { modifyMiniWebpackChain } from './webpack.mini'

type CompilerOptions = {
  isCustomElement: (tag: string) => boolean
  whitespace: 'condense' | 'preserve'
  delimiters: string[]
  comments: boolean
  nodeTransforms: ((...args: any) => void)[]
}
export interface IConfig {
  mini?: {
    compilerOptions: CompilerOptions
  },
  vueLoaderOption?: {
    compilerOptions: CompilerOptions
    [key: string]: any
  }
}

export default (ctx: IPluginContext, config: IConfig = {}) => {
  const { framework } = ctx.initialConfig
  if (framework !== 'vue3') return

  ctx.modifyWebpackChain(({ chain, data }) => {
    // 通用
    if (process.env.NODE_ENV !== 'production') {
      setAlias(chain)
    }
    setDefinePlugin(chain)

    if (process.env.TARO_ENV === 'h5') {
      // H5
      modifyH5WebpackChain(ctx, chain, config)
    } else {
      // 小程序
      modifyMiniWebpackChain(ctx, chain, data, config)
    }
  })

  ctx.modifyRunnerOpts(({ opts }) => {
    if (!opts?.compiler) return

    const { compiler } = opts
    const WEBPACK5 = 'webpack5'
    // 提供给 webpack5 依赖预编译收集器的第三方依赖
    const deps = ['@tarojs/plugin-framework-vue3/dist/runtime']
    if (compiler === WEBPACK5) {
      opts.compiler = {
        type: WEBPACK5,
        prebundle: {
          include: deps
        }
      }
    } else if (typeof compiler === 'object' && compiler.type === WEBPACK5) {
      compiler.prebundle ||= {}
      const prebundleOptions = compiler.prebundle
      prebundleOptions.include ||= []
      prebundleOptions.include = prebundleOptions.include.concat(deps)
    }
  })
}

function setAlias (chain) {
  // 避免 npm link 时，taro composition apis 使用的 vue 和项目使用的 vue 实例不一致。
  chain.resolve.alias
    .set('vue', require.resolve('vue'))
}

function setDefinePlugin (chain) {
  chain
    .plugin('definePlugin')
    .tap(args => {
      const config = args[0]
      config.__VUE_OPTIONS_API__ = JSON.stringify(true)
      config.__VUE_PROD_DEVTOOLS__ = JSON.stringify(false)
      return args
    })
}

export function getVueLoaderPath (): string {
  try {
    return require.resolve('vue-loader', {
      paths: [process.cwd()]
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(chalk.yellow('找不到 vue-loader，请先安装。'))
    process.exit(1)
  }
}
