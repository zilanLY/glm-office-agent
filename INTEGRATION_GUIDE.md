# GLM Office Agent + WorkBuddy 整合方案

## 🎯 项目愿景

将 **GLM-Free-API 免登录架构**与 **WorkBuddy 完整的专家系统**融合，打造一个功能更强大的桌面 AI 办公助手。

---

## 📊 功能对比与互补

| 维度 | GLM Office Agent | WorkBuddy | 整合后优势 |
|------|------------------|-----------|-----------|
| **模型接入** | ✅ GLM 免登录 | ❌ 需官方账号 | 低成本免登录 + 多模型支持 |
| **专家系统** | ❌ 无 | ✅ 100+ 预设专家 | 丰富的垂直领域能力 |
| **技能市场** | ⚠️ 简单工具定义 | ✅ 完整 Skills 生态 | 可扩展的技能体系 |
| **自动任务** | ❌ 无 | ✅ 定时/周期任务 | 主动式办公自动化 |
| **团队执行** | ❌ 单助手 | ✅ 多专家协作 | 复杂任务的分工合作 |
| **架构成熟度** | ✅ Go+Electron | ⚠️ Electron 单进程 | 高性能服务分离架构 |

---

## 🏗️ 整合后的新架构

```
┌─────────────────────────────────────────────────────────┐
│           GLM-WorkBuddy Desktop App                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │   Frontend (React from WorkBuddy)                  │  │
│  │  - Chat Interface with Expert Selection            │  │
│  │  - Skill Marketplace                               │  │
│  │  - Auto Task Scheduler                             │  │
│  │  - Team Collaboration                              │  │
│  └─────────────────────┬─────────────────────────────┘  │
└────────────────────────┼────────────────────────────────┘
                         │ IPC / HTTP
┌────────────────────────▼────────────────────────────────┐
│         Service Layer (Multi-Backend Support)           │
│                                                         │
│  ┌─────────────────┐    ┌───────────────────────────┐  │
│  │ GLM-Free-API    │    │ Python Backend Service    │  │
│  │ • Proxy Mode    │    │ • File Operations API     │  │
│  │ • Tool Calling  │    │ • OCR (PaddleOCR)         │  │
│  │ • Guest Token   │    │ • Document Parsing        │  │
│  └─────────────────┘    └───────────────────────────┘  │
│                                                         │
│  ┌─────────────────┐    ┌───────────────────────────┐  │
│  │ Local Storage   │    │ Memory & Knowledge Base   │  │
│  │ • Session Data  │    │ • SQLite + ChromaDB       │  │
│  │ • Expert Config │    │ • Vector Search           │  │
│  └─────────────────┘    └───────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 整合模块清单

### Module 1: 专家系统迁移 (`src/lib/experts`)

从 WorkBuddy 迁移的核心组件：

```typescript
// 新增文件结构
src/
├── lib/
│   ├── experts.ts          # 专家管理逻辑（从 WorkBuddy api.ts）
│   ├── teams.ts            # 专家团队系统（WorkBuddy Teams）
│   └── skills.ts           # 技能库管理（WorkBuddy Skills）
├── components/
│   ├── Experts.tsx         # 专家选择界面
│   ├── Teams.tsx           # 团队协作界面
│   └── Skills.tsx          # 技能市场界面
└── hooks/
    ├── useExpert.ts        # 专家相关 Hook
    └── useAutoTask.ts      # 自动任务 Hook
```

**核心数据结构：**
```typescript
interface Expert {
  id: string;
  name: string;
  domain: string;
  icon?: string;
  title: string;
  description?: string;
  persona?: string;           // 自定义人设
  methodology?: string;       // 工作方法论
  tools?: string;             // 擅长工具链
}

interface Team {
  id: string;
  name: string;
  leader: Expert;
  members: Expert[];
  desc: string;
  openers: string[];          // 快捷开场白
}

interface Skill {
  id: string;
  name: string;
  content: string;            // System Prompt
  category: string;
  builtin: boolean;
}
```

### Module 2: 自动任务调度器 (`src/services/auto-scheduler`)

WorkBuddy 的自动化任务系统集成：

```typescript
// src/types/task.ts
type TaskType = 'daily' | 'weekly' | 'monthly' | 'once' | 'interval';

interface AutoTask {
  id: string;
  name: string;
  prompt: string;
  type: TaskType;
  time?: string;              // 例如："09:00"
  weekdays?: number[];        // [1,3,5] 周一三五
  day?: number;               // 每月 X 日
  intervalMinutes?: number;   // 每 X 分钟
  expertId?: string;          // 哪个专家执行
  skillId?: string;           // 使用哪个技能
  enabled: boolean;
  createdAt: number;
  nextRun?: number;
}

interface RunRecord {
  taskId: string;
  status: 'running' | 'success' | 'error';
  output?: string;
  error?: string;
  startedAt: number;
  finishedAt?: number;
}
```

**实现示例：**
```typescript
// src/services/auto-scheduler.ts
import APScheduler from 'apscheduler';

export class AutoScheduler {
  private scheduler: APScheduler;
  private tasks: Map<string, AutoTask>;

  async start() {
    this.scheduler = new APScheduler();
    
    for (const task of this.tasks.values()) {
      if (!task.enabled || !task.nextRun) continue;
      
      const schedule = this.convertToSchedule(task);
      this.scheduler.addJob(schedule, async () => {
        await this.executeTask(task);
      });
    }
    
    this.scheduler.start();
  }

  private convertToSchedule(task: AutoTask): any {
    switch (task.type) {
      case 'daily':
        return { cron: `${task.time} * * * *` };
      case 'weekly':
        return { cron: `${task.time} * * * ${task.weekdays?.join(',') || '*'}` };
      case 'interval':
        return { interval: `${task.intervalMinutes} minutes` };
      // ... 其他类型
    }
  }

  private async executeTask(task: AutoTask) {
    // 调用 GLM-Free-API 或 WorkBuddy LLM
    const result = await this.callLLM(task.prompt, task.expertId);
    
    // 记录运行结果
    await this.saveRunRecord({
      taskId: task.id,
      status: 'success',
      output: result,
      startedAt: Date.now(),
      finishedAt: Date.now()
    });
  }
}
```

### Module 3: 团队协作模式 (`src/services/team-collaboration`)

WorkBuddy 的 Multi-Agent 系统设计：

```typescript
interface TeamProgress {
  runId: string;
  teamId: string;
  goal: string;
  stage: 'plan' | 'clarify' | 'execute' | 'summarize' | 'done' | 'error';
  plan?: {
    id: string;
    title: string;
    expert: string;
    brief: string;
    status: string;
    output?: string;
  }[];
  clarify?: string[];         // 需要用户澄清的问题
  summary?: string;
}

export class TeamCollaborator {
  constructor(
    private team: Team,
    private llmProvider: GLMFreeProvider
  ) {}

  async executeGoal(goal: string): Promise<TeamProgress> {
    // Step 1: Plan - 分解目标到各专家
    const plan = await this.generatePlan(goal);
    
    // Step 2: Clarify - 询问用户需要补充的信息
    const questions = await this.askClarifyingQuestions(plan);
    
    // Step 3: Execute - 各专家并行执行任务
    const results = await Promise.all(
      plan.map(async (task) => {
        const expert = this.team.getExpert(task.expert);
        return await expert.execute(task.brief);
      })
    );
    
    // Step 4: Summarize - 汇总输出
    const summary = await this.summarizeResults(results);
    
    return { runId: generateId(), teamId: this.team.id, goal, stage: 'done', summary };
  }
}
```

### Module 4: Python 后端集成 (`python_backend`)

新增的本地服务器处理文件操作：

```bash
python_backend/
├── server.py                # FastAPI 主服务
├── file_operations.py       # 文件管理 API
├── document_parser.py       # PDF/Word/Excel 解析
├── ocr_service.py           # PaddleOCR 集成
└── requirements.txt
```

**API 接口定义：**
```python
# python_backend/file_operations.py
from fastapi import APIRouter
import pathlib, shutil, re

router = APIRouter()

@router.post("/files/search")
async def search_files(pattern: str, path: str = "~"):
    """搜索匹配的文件"""
    p = pathlib.Path(path).expanduser()
    results = []
    for f in p.rglob(pattern):
        if f.is_file():
            results.append({
                "path": str(f),
                "size": f.stat().st_size,
                "modified": f.stat().st_mtime
            })
    return {"files": results}

@router.post("/files/rename/batch")
async def batch_rename(files: list[str], pattern: str, replacement: str):
    """批量重命名文件"""
    renamed = []
    for f_path in files:
        p = pathlib.Path(f_path)
        new_name = re.sub(pattern, replacement, p.name)
        new_path = p.parent / new_name
        p.rename(new_path)
        renamed.append(str(new_path))
    return {"renamed": renamed}

@router.post("/docs/read_pdf")
async def read_pdf(file_path: str, page_range: str = "all"):
    """读取 PDF 内容"""
    import pdfplumber
    
    with pdfplumber.open(file_path) as pdf:
        pages = pdf.pages
        if page_range != "all":
            start, end = map(int, page_range.split("-"))
            pages = pages[start:end+1]
        
        text = "\n".join([page.extract_text() or "" for page in pages])
        return {"content": text, "pages": len(pages)}
```

**启动脚本：**
```javascript
// scripts/start-python-server.js
const { spawn } = require('child_process');
const axios = require('axios');

async function startPythonServer(port = 8000) {
  const server = spawn('python', ['python_backend/server.py']);
  
  // 等待服务就绪
  for (let i = 0; i < 30; i++) {
    try {
      await axios.get(`http://localhost:${port}/health`);
      console.log('✅ Python Backend started');
      return;
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('Python backend failed to start');
}

module.exports = { startPythonServer };
```

---

## 🔄 数据流设计

### 场景演示：用户上传一份 Excel 报表

```
用户请求 → GLM Office Agent UI
  ├─ Step 1: 意图识别
  │   └─ GLM-Free-API (glm-4.7, tool calling)
  │       ├─ Detect: Need to read Excel
  │       └─ Select Tools: read_document + analyze_excel
  │
  ├─ Step 2: 调用 Python 后端
  │   └─ POST http://localhost:8000/excel/read
  │       ├─ Read cell data
  │       ├─ Calculate formulas
  │       └─ Extract charts metadata
  │
  ├─ Step 3: 数据分析
  │   ├─ Option A: 单助手模式
  │   │   └─ Excel Specialist Expert
  │   │       └─ Generate insights report
  │   │
  │   └─ Option B: 团队协作模式
  │       ├─ Data Analyst → Clean data
  │       ├─ Business Analyst → Market trends
  │       └─ Report Writer → Format output
  │
  └─ Step 4: 返回结果
      └─ Markdown + Charts + Summary Table
```

---

## 📝 实施步骤

### Phase 1: 基础架构搭建 (Week 1)

1. **设置项目骨架**
   ```bash
   mkdir glm-workbuddy
   cd glm-workbuddy
   
   # 前端部分（复制 WorkBuddy 的 React 代码）
   cp -r ../workbuddy-oc-main/src/* src/
   
   # 后端部分（集成 GLM-Free-API + Python）
   cp -r ../glm-office-agent/src/main ./backend
   mkdir -p python_backend
   ```

2. **配置依赖**
   ```json
   package.json 合并依赖项:
   {
     "dependencies": {
       "electron": "^28",
       "react": "^18",
       // ... GLM Office Agent deps
       // ... WorkBuddy deps (chakra-ui, framer-motion 等)
     },
     "devDependencies": {
       "@types/node": "^20",
       "vite": "^5",
       "electron-builder": "^24"
     }
   }
   ```

3. **集成 TypeScript 类型定义**
   ```typescript
   // src/wb.d.ts (从 WorkBuddy)
   interface Window {
     wb: {
       expertsList: () => Promise<Expert[]>;
       teamRun: (id: string, goal: string) => void;
       // ... 其他方法
     };
   }
   
   // backend/src/types/index.ts (从 GLM Office Agent)
   interface GLMChatRequest { /* ... */ }
   ```

### Phase 2: 专家系统移植 (Week 2)

1. **重构 Expert Manager**
   ```typescript
   // backend/src/services/expert-manager.ts
   export class ExpertManager {
     private experts: Map<string, Expert>;
     
     async loadBuiltInExperts() {
       // 加载预置的 100+ 专家定义
       const jsonFiles = glob.sync('../data/experts/*.json');
       for (const file of jsonFiles) {
         const expert = JSON.parse(await fs.readFile(file, 'utf-8'));
         this.experts.set(expert.id, expert);
       }
     }
     
     async getChatPrompt(expertId: string, userMessage: string): Promise<any> {
       const expert = this.experts.get(expertId);
       
       // 构建带专家人设的系统提示词
       const systemPrompt = `
         You are ${expert.name}, a ${expert.domain} expert.
         
         ## Profile
         ${expert.persona || ''}
         
         ## Methodology
         ${expert.methodology || ''}
         
         Today's date: ${new Date().toLocaleDateString()}
         
         User message: ${userMessage}
       `;
       
       // 调用 GLM-Free-API
       return await this.llm.chat([{ role: 'system', content: systemPrompt }]);
     }
   }
   ```

2. **Team 系统实现**
   ```typescript
   // backend/src/services/team-collaborator.ts
   export class TeamCollaborator {
     async execute(teamId: string, goal: string): Promise<TeamProgress> {
       const team = this.teams.get(teamId);
       
       // 1. 生成计划
       const plan = await this.planExecution(team, goal);
       
       // 2. 分配任务给各专家
       for (const task of plan.tasks) {
         const expert = await this.getExpert(task.expertId);
         const result = await expert.execute(task.brief);
         
         // 实时更新进度
         await this.updateProgress(runId, {
           stage: 'execute',
           output: result.summary
         });
       }
       
       // 3. 汇总输出
       const summary = await this.summarize(plan, results);
       return { stage: 'done', summary };
     }
   }
   ```

### Phase 3: 自动任务集成 (Week 3)

1. **APScheduler 集成**
   ```python
   # python_backend/autotask_scheduler.py
   from apscheduler.schedulers.asyncio import AsyncIOScheduler
   from datetime import datetime
   
   class AutoTaskScheduler:
       def __init__(self, db_session):
           self.scheduler = AsyncIOScheduler()
           self.db = db_session
           
       def add_daily_task(self, task_id: str, time: str):
           """添加每日任务"""
           hour, minute = map(int, time.split(':'))
           
           self.scheduler.add_job(
               self.run_task,
               'cron',
               hour=hour,
               minute=minute,
               args=[task_id],
               id=task_id
           )
           
       async def run_task(self, task_id: str):
           """执行单个任务"""
           task = self.db.get_task(task_id)
           
           # 调用后端 LLM API
           result = await call_llm(task.prompt, task.expert_id)
           
           # 保存运行记录
           self.db.create_run_record(task_id, result)
           
       def start(self):
           self.scheduler.start()
   ```

2. **UI 集成**
   ```typescript
   // src/components/AutoTasks.tsx
   import { AutoTask, schedText } from '../lib/tasks';
   
   export default function AutoTasks({ tasks }: { tasks: AutoTask[] }) {
     return (
       <div className="auto-task-list">
         {tasks.map(task => (
           <div key={task.id} className="task-card">
             <h3>{task.name}</h3>
             <p className="schedule">{schedText(task)}</p>
             <button onClick={() => toggleTask(task)}>
               {task.enabled ? '暂停' : '启用'}
             </button>
             <button onClick={() => runNow(task)}>立即执行</button>
             
             {/* 最近运行记录 */}
             <div className="run-history">
               {task.runs?.map(run => (
                 <div key={run.id} className={`run ${run.status}`}>
                   {formatTime(run.startedAt)} - {run.output?.substring(0, 50)}...
                 </div>
               ))}
             </div>
           </div>
         ))}
       </div>
     );
   }
   ```

### Phase 4: Python 后端完善 (Week 4)

1. **文档解析器**
   ```python
   # python_backend/document_parser.py
   import docx, openpyxl, pptx, pdfplumber
   
   class DocumentParser:
       @staticmethod
       def read_docx(file_path: str) -> dict:
           doc = docx.Document(file_path)
           return {
               "title": doc.paragraphs[0].text if doc.paragraphs else "",
               "content": "\n\n".join([p.text for p in doc.paragraphs]),
               "tables": [[cell.text for cell in row.cells] 
                         for table in doc.tables 
                         for row in table.rows]
           }
       
       @staticmethod
       def read_excel(file_path: str) -> dict:
           wb = openpyxl.load_workbook(file_path)
           sheets = {}
           for sheet_name in wb.sheetnames:
               ws = wb[sheet_name]
               sheets[sheet_name] = {
                   "headers": [cell.value for cell in ws[1]],
                   "rows": [[cell.value for cell in row] 
                           for row in ws.iter_rows(min_row=2)]
               }
           return {"sheets": sheets}
   ```

2. **OCR 集成**
   ```python
   # python_backend/ocr_service.py
   from paddleocr import PPArgument
   
   class OCRService:
       def __init__(self):
           self.ocr = PPArgument(lang='ch')  # 中英混合
       
       async def recognize_image(self, image_path: str) -> str:
           """识别图片中的文字"""
           result = self.ocr.ocr(image_path, cls=True)
           texts = []
           for line in result[0]:
               text, confidence = line[1]
               texts.append(text)
           return "\n".join(texts)
   ```

### Phase 5: 测试与优化 (Week 5)

1. **单元测试**
   ```python
   # tests/test_file_operations.py
   import pytest
   from fastapi.testclient import TestClient
   from python_backend.server import app
   
   client = TestClient(app)
   
   def test_search_files(tmp_path):
       # 创建测试文件
       test_file = tmp_path / "test.pdf"
       test_file.write_text("test content")
       
       response = client.post(
           "/files/search",
           json={"pattern": "*.pdf", "path": str(tmp_path)}
       )
       
       assert response.status_code == 200
       assert len(response.json()["files"]) == 1
   ```

2. **性能测试**
   ```bash
   # 压测文件搜索接口
   ab -n 1000 -c 10 http://localhost:8000/files/search
   
   # GLM-Free-API 并发测试
   wrk -t4 -c10 -d30 http://localhost:3000/v1/chat/completions
   ```

---

## 🚀 快速启动指南（整合版）

```bash
# 1. 克隆并解压所有资源
git clone https://github.com/your-repo/glm-workbuddy.git
cd glm-workbuddy

npm install

# 2. 编译 Go 二进制
git clone https://github.com/izaart95-jpg/GLM-Free-API.git ../GLM-Free-API
npm run postinstall

# 3. 安装 Python 依赖
pip install -r python_backend/requirements.txt

# 4. 启动开发环境
npm run dev

# 这会同时启动：
# - Vite Dev Server (http://localhost:5173)
# - GLM-Free-API (http://localhost:3000)
# - Python Backend (http://localhost:8000)
# - Electron Desktop App
```

---

## 🎨 预期效果展示

### Before vs After

| 功能 | GLM Office Agent 原版 | 整合后的 GLM-WorkBuddy |
|------|---------------------|------------------------|
| **专家选择** | ❌ 通用助手 | ✅ 100+ 预设专家可选 |
| **团队协作** | ❌ 不支持 | ✅ 多专家协同工作 |
| **自动任务** | ❌ 不支持 | ✅ 每日/每周/每月定时任务 |
| **技能扩展** | ⚠️ 简单工具定义 | ✅ 完整的 Skills 市场 |
| **免登录** | ✅ | ✅ |
| **跨平台部署** | ✅ | ✅ (支持局域网桥接) |

---

## 💡 下一步优化方向

### 短期（1-2 个月）

1. **记忆增强**
   - SQLite + ChromaDB 实现长期记忆
   - 基于对话历史的智能上下文管理

2. **插件生态**
   - 定义统一的插件 API
   - 社区贡献的工作流模板

3. **移动端适配**
   - 支持手机通过浏览器远程连接
   - WebSockets 实时推送通知

### 中期（3-6 个月）

1. **企业级功能**
   - 权限管理与审计日志
   - 数据加密存储
   - SSO 集成

2. **多模型支持**
   - 切换不同 Provider（GLM/Qwen/Kimi）
   - 模型路由与负载均衡

3. **高级自动化**
   - RPA 机器人流程自动化
   - 跨应用工作流编排

### 长期（6 个月+）

1. **AI Agents 平台**
   - 可视化 Agent 编排工具
   - 训练和 fine-tuning 自定义 Agent

2. **开源生态建设**
   - GitHub 开源版本
   - 社区驱动的专家和技能贡献

---

## 📚 学习资源

### WorkBuddy 相关
- [WorkBuddy 官方仓库](https://github.com/tencent/workbuddy) (假设)
- 专家系统设计哲学
- Skills 生态系统架构

### GLM-Free-API 相关
- [上游项目](https://github.com/izaart95-jpg/GLM-Free-API)
- Playwright headless browser 使用指南

### Python 后端开发
- FastAPI 官方文档
- PDFPlumber、python-docx、openpyxl 等库的使用

---

## ⚠️ 注意事项

1. **法律合规**: 继续遵守"仅供学习和研究"的免责声明
2. **性能监控**: 注意内存泄漏和长时间运行的稳定性
3. **用户隐私**: 确保所有数据存储在本地，不上传云端
4. **错误处理**: 完善的异常捕获和降级策略

---

**版本**: v2.0 整合版  
**最后更新**: 2026-10-01  
**维护者**: QClaw Team
