# 首批内容自动生产流水线

## 阶段边界

首批选择覆盖矩阵中的 `batch-01`，共30人，覆盖8个主地区和6个时代。生产任务存放在：

```text
content/knowledge/production/batches/batch-01/
  manifest.json
  tasks/
    candidate-001.json
    ...
```

这些文件是研究与编辑任务，不是公开知识实体。任务始终保持：

```text
editorialStatus: candidate
publicVisibility: false
```

只有 `content/knowledge/people`、`concepts`、`traditions` 等正式实体目录中的 `published` 记录才进入网站。生产任务不会进入搜索索引、3D地球或详情页。

## 七阶段状态机

```text
身份与年代 ─┐
             ├→ 索引草稿 → 引用定位 → 偏差与反例 → 编辑装配
来源发现 → 来源核验 ┘
```

1. `identity-and-chronology`：核验姓名、别名、身份、生卒或活动年代及确定性。
2. `source-discovery`：登记原典、学术专著、同行评审研究和专家百科候选来源。
3. `source-verification`：核验责任者、出版信息与URL、DOI或ISBN；参考数据集不能单独支撑观点。
4. `index-draft`：形成80–180字摘要、核心问题、论点、概念、作品和地点草稿。
5. `citation-location`：为身份、年代、语境、论点、概念、作品和地点逐项绑定来源定位。
6. `bias-and-counterevidence`：检查跨文化分类偏差、反例、归属争议与不确定性。
7. `editorial-assembly`：确认门禁通过，只允许进入candidate实体装配，禁止自动发布。

各阶段不能跳过依赖。失败任务最多自动尝试三次；只有明确标记为可重试且未耗尽预算的任务才能重置。重试耗尽进入阻断报告，不通过降低证据标准解决。

## 常用命令

```bash
# 首次生成或补齐缺失任务；不会覆盖已经推进的任务状态
npm run content:batch:prepare

# 验证覆盖矩阵、manifest和30个独立任务是否稳定
npm run content:batch:check

# 生成当前可执行的工作包和批次报告
npm run content:batch:queue

# 应用自动工作者返回的JSON结果文件
npm run content:batch:apply -- /absolute/path/to/results.json

# 重置仍在预算内的可重试失败任务
npm run content:batch:retry

# 只刷新批次状态报告
npm run content:batch:report
```

队列和报告写入 `artifacts/production/batch-01/`，不进入版本库。工作者结果必须说明自动工作者身份；失败结果必须包含错误码、说明和是否可重试。任何结果都不能写入 `published`。

每个队列工作包都包含建议的 `resultId`、阶段说明、当前候选上下文、阶段专用字段契约和安全边界。工作者应原样返回该 `resultId`。相同结果重复投递是幂等的，不会重复增加尝试次数；同一结果文件出现重复 `resultId` 会在任何任务写回前整体拒绝。

失败结果的最小结构如下：

```json
{
  "schemaVersion": 1,
  "resultId": "batch-01:candidate-001:source-discovery:attempt-1",
  "batchId": "batch-01",
  "candidateId": "candidate-001",
  "stage": "source-discovery",
  "outcome": "failed",
  "worker": "automated-content-worker/v1",
  "error": {
    "code": "source-access-failed",
    "message": "无法访问足够的学术来源元数据。",
    "retryable": true
  }
}
```

## 装配门禁

任务进入 `ready-for-promotion` 前必须同时满足：

- 达到最低已核验来源数量，且至少包含一种独立学术来源；
- 已核验来源包含URL、DOI或ISBN，并记录核验方法与时间；
- 所有主张任务均有已核验来源和页码、章节、段落或稳定小节；
- 摘要、概念和地点满足索引级最低要求；
- 跨文化偏差、反例和归属不确定性检查全部通过；
- 所有七个工作项通过，且任务仍为私有candidate。

`ready-for-promotion` 只表示可以形成正式candidate实体，并不等于 `published`。最终发布、合并 `main` 和部署仍需用户最终批准。
