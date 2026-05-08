import path from 'node:path'

function resolvePath(value: string) {
  return path.isAbsolute(value) ? value : path.join(/* turbopackIgnore: true */ process.cwd(), value)
}

const workspace = resolvePath(process.env.SOFTWAREHOUSE_WORKSPACE || './.runtime')

export const paths = {
  workspace,
  pipeline: resolvePath(process.env.SOFTWAREHOUSE_PIPELINE || './scripts/update_pipeline.sh'),
  feedback: resolvePath(process.env.SOFTWAREHOUSE_FEEDBACK || './.runtime/data/feedback.json'),
  opportunities: resolvePath(process.env.SOFTWAREHOUSE_OPPORTUNITIES || './.runtime/out/opportunities.feedback.json'),
  emlDir: resolvePath(process.env.SOFTWAREHOUSE_EML_DIR || './.runtime/emls'),
  importState: resolvePath(process.env.SOFTWAREHOUSE_IMPORT_STATE || './.runtime/data/import-state.json'),
}
