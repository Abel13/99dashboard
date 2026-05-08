import path from 'node:path'

function resolvePath(value: string) {
  return path.isAbsolute(value) ? value : path.join(/* turbopackIgnore: true */ process.cwd(), value)
}

const workspace = resolvePath(process.env.SOFTWAREHOUSE_WORKSPACE || './storage')

export const paths = {
  workspace,
  pipeline: resolvePath(process.env.SOFTWAREHOUSE_PIPELINE || './scripts/update_pipeline.sh'),
  feedback: resolvePath(process.env.SOFTWAREHOUSE_FEEDBACK || './storage/data/feedback.json'),
  opportunities: resolvePath(process.env.SOFTWAREHOUSE_OPPORTUNITIES || './storage/out/opportunities.feedback.json'),
  emlDir: resolvePath(process.env.SOFTWAREHOUSE_EML_DIR || './storage/emls'),
  importState: resolvePath(process.env.SOFTWAREHOUSE_IMPORT_STATE || './storage/data/import-state.json'),
}
