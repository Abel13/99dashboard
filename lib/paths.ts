export const paths = {
  workspace: process.env.SOFTWAREHOUSE_WORKSPACE || '/home/abel13/.openclaw/workspace/softwarehouse',
  pipeline: process.env.SOFTWAREHOUSE_PIPELINE || '/home/abel13/.openclaw/workspace/softwarehouse/scripts/update_pipeline.sh',
  feedback: process.env.SOFTWAREHOUSE_FEEDBACK || '/home/abel13/.openclaw/workspace/softwarehouse/data/feedback.json',
  opportunities: process.env.SOFTWAREHOUSE_OPPORTUNITIES || '/home/abel13/.openclaw/workspace/softwarehouse/out/opportunities.feedback.json',
  emlDir: process.env.SOFTWAREHOUSE_EML_DIR || '/mnt/c/Users/abelo/OneDrive/Workspace/Softwarehouse',
}

