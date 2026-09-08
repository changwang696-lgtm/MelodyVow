# SUNO AI 对接说明书

## 项目概述

本微信小程序是一个基于SUNO AI的音乐生成应用，支持多种生成模式和完整的音乐生成流程。项目采用微信小程序云开发架构，通过云函数与SUNO AI API进行对接。

## 项目架构

### 技术栈
- **前端**: 微信小程序原生开发
- **后端**: 微信云开发 + 云函数
- **数据库**: 微信云数据库
- **API**: SUNO AI 第三方音乐生成API

### 目录结构
```
miniprogram-63/
├── pages/                    # 小程序页面
│   └── index/               # 主页面
│       ├── index.js         # 主要业务逻辑
│       ├── index.wxml       # 页面结构
│       └── index.wxss       # 页面样式
├── cloudfunctions/          # 云函数目录
│   ├── generateMusic/       # 音乐生成云函数
│   ├── musicCallback/       # 音乐回调处理云函数
│   ├── queryTask/          # 任务查询云函数
│   └── saveAudioRecord/    # 音频记录保存云函数
├── utils/                   # 工具类
│   ├── apiClient.js        # API客户端工具
│   └── apiErrorHandler.js  # API错误处理工具
├── docs/                    # 文档目录
│   ├── SUNO AI指令结构详解.md
│   ├── AI音乐生成回调机制详解.md
│   └── 其他技术文档...
└── project.config.json      # 项目配置文件
```

## SUNO AI 对接详情

### API 配置信息

**API 基础信息:**
- **API 地址**: `https://api.wike.cc/api/suno/`
- **认证方式**: Authorization Header
- **API Key**: `BRG6AyDz2vT72dgv0ON3kfqJXt`
- **超时设置**: 60秒

**支持的接口:**
1. **音乐生成接口**: `/api/suno/generate`
2. **任务查询接口**: `/api/suno/feed`

### 云函数架构

#### 1. generateMusic 云函数
**文件位置**: `cloudfunctions/generateMusic/index.js`

**主要功能**:
- 接收前端音乐生成请求
- 调用SUNO AI生成接口
- 处理API响应并存储任务信息
- 返回任务ID给前端

**核心代码逻辑**:
```javascript
// 调用SUNO AI API
const response = await axios.post('https://api.wike.cc/api/suno/generate', {
  mv: 'chirp-v4-5',                    // 模型版本
  custom_mode: customMode || false,     // 生成模式
  make_instrumental: instrumental || false, // 是否纯音乐
  gpt_description_prompt: description,  // 音乐描述
  title: title || 'AI生成音乐',        // 音乐标题
  callback_url: callbackUrl            // 回调地址
}, {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'BRG6AyDz2vT72dgv0ON3kfqJXt'
  },
  timeout: 60000
})
```

**数据库操作**:
- 将任务信息存储到 `music_tasks` 集合
- 记录任务状态为 `pending`

#### 2. musicCallback 云函数
**文件位置**: `cloudfunctions/musicCallback/index.js`

**主要功能**:
- 接收SUNO AI的回调通知
- 更新音乐任务状态
- 处理音频URL和歌词数据
- 调用saveAudioRecord保存完整记录

**回调数据处理**:
```javascript
// 处理回调数据的兼容性
const taskId = callbackData.taskId || callbackData.task_id
const title = callbackData.title || callbackData.data?.title || '未命名音乐'
const audioUrl = callbackData.audio_url || callbackData.audioUrl || ''
const imageUrl = callbackData.image_url || callbackData.imageUrl || ''
const lyrics = callbackData.text || callbackData.lyrics || callbackData.data?.text || null
```

#### 3. queryTask 云函数
**文件位置**: `cloudfunctions/queryTask/index.js`

**主要功能**:
- 主动查询SUNO AI任务状态
- 更新本地数据库记录
- 支持手动刷新任务状态

#### 4. saveAudioRecord 云函数
**文件位置**: `cloudfunctions/saveAudioRecord/index.js`

**主要功能**:
- 保存完整的音频记录到 `audio_records` 集合
- 支持创建和更新操作
- 记录详细的时间戳和状态信息

### 前端业务逻辑

#### 主要文件
**文件位置**: `pages/index/index.js`

#### 生成模式

**1. 灵感模式 (inspiration)**
- 用户输入简单的音乐描述
- 使用 `custom_mode: 0`
- 直接使用 `prompt` 字段

**2. 专业模式 (professional)**
- 支持详细的参数配置
- 使用 `custom_mode: 1`
- 支持标题、歌词、风格、声音类型设置

**3. 大师模式 (master)**
- 最高级的自定义配置
- 使用 `custom_mode: 1`
- 完全自定义所有参数

#### 核心生成函数
**函数名**: `devTestSunoAI()`

**主要逻辑**:
```javascript
// 根据模式构建请求参数
let requestData = {
  mv: versionOptions[selectedVersionIndex].value, // 版本选择
  title: 'AI生成音乐'
}

if (currentMode === 'inspiration') {
  requestData.custom_mode = 0
  requestData.make_instrumental = 0
  requestData.prompt = musicDescription
} else if (currentMode === 'professional') {
  requestData.custom_mode = 1
  requestData.make_instrumental = proSettings.instrumental ? 1 : 0
  requestData.title = proSettings.title.trim() || 'AI生成音乐'
  // 构建标签和歌词...
}
```

#### 状态管理
- **pending**: 等待生成
- **partial**: 部分完成
- **completed**: 生成完成
- **failed**: 生成失败

### 数据库设计

#### music_tasks 集合
**用途**: 存储音乐生成任务的基本信息

**字段结构**:
```javascript
{
  taskId: String,        // SUNO AI任务ID
  description: String,   // 音乐描述
  title: String,        // 音乐标题
  audioUrl: String,     // 音频链接
  imageUrl: String,     // 封面图片链接
  status: String,       // 任务状态
  createTime: Date,     // 创建时间
  updateTime: Date      // 更新时间
}
```

#### audio_records 集合
**用途**: 存储完整的音频记录信息

**字段结构**:
```javascript
{
  taskId: String,           // 关联的任务ID
  userId: String,           // 用户ID
  title: String,           // 音乐标题
  description: String,     // 描述
  audioUrl: String,        // 音频URL
  imageUrl: String,        // 图片URL
  status: Number,          // 状态码
  lyrics: String,          // 歌词
  createTime: Date,        // 创建时间
  completedTime: Date,     // 完成时间
  callbackCount: Number    // 回调次数
}
```

### 工具类说明

#### APIClient 工具类
**文件位置**: `utils/apiClient.js`

**主要功能**:
- 封装HTTP请求逻辑
- 支持重试机制
- 提供音乐生成和查询的便捷方法

#### APIErrorHandler 工具类
**文件位置**: `utils/apiErrorHandler.js`

**主要功能**:
- 统一处理API错误
- 支持指数退避重试
- 提供详细的错误分类和处理

### 回调机制

#### 回调URL配置
**回调地址**: `https://w3-9gkdn5186e38c978.service.tcloudbase.com/musicCallback`

#### 回调流程
1. SUNO AI生成音乐完成后，向回调URL发送POST请求
2. `musicCallback` 云函数接收并处理回调数据
3. 更新 `music_tasks` 集合中的任务状态
4. 如果有歌词数据，调用 `saveAudioRecord` 保存到 `audio_records` 集合

#### 回调数据格式
```javascript
{
  "task_id": "string",      // 任务ID
  "title": "string",        // 音乐标题
  "audio_url": "string",    // 音频链接
  "image_url": "string",    // 图片链接
  "status": "3",           // 状态码
  "text": "string"         // 歌词内容
}
```

### 版本支持

#### 支持的SUNO AI模型版本
- **chirp-v4-5**: 最新版本，推荐使用
- **chirp-v3-5**: 稳定版本
- **chirp-v3-0**: 早期版本

#### 版本选择逻辑
```javascript
versionOptions: [
  { name: 'v4.5', value: 'chirp-v4-5' },
  { name: 'v3.5', value: 'chirp-v3-5' },
  { name: 'v3.0', value: 'chirp-v3-0' }
]
```

### 错误处理

#### 常见错误类型
1. **网络错误**: 超时、连接失败
2. **API错误**: 认证失败、参数错误
3. **业务错误**: 生成失败、回调异常

#### 错误处理策略
- 自动重试机制（最多3次）
- 指数退避算法
- 详细的错误日志记录
- 用户友好的错误提示

### 部署说明

#### 云函数部署
1. 在微信开发者工具中打开项目
2. 右键点击 `cloudfunctions` 目录
3. 选择"上传并部署：云端安装依赖"
4. 等待部署完成

#### 环境配置
- **云开发环境ID**: `w3-9gkdn5186e38c978`
- **小程序AppID**: `wx3dee9e18937cbcef`

#### 权限配置
确保云函数具有以下权限:
- 数据库读写权限
- HTTP外网访问权限
- 云函数互相调用权限

### 使用流程

#### 完整的音乐生成流程
1. **用户输入**: 在小程序中输入音乐描述或配置参数
2. **前端验证**: 验证输入参数的完整性
3. **调用云函数**: 调用 `generateMusic` 云函数
4. **API请求**: 云函数向SUNO AI发送生成请求
5. **任务创建**: 将任务信息存储到数据库
6. **等待回调**: SUNO AI异步生成音乐
7. **接收回调**: `musicCallback` 云函数处理回调
8. **更新状态**: 更新数据库中的任务状态
9. **用户播放**: 用户可以播放生成的音乐

### 监控和调试

#### 日志查看
- 在微信开发者工具的"云开发"面板查看云函数日志
- 关键日志包括API请求、回调处理、错误信息

#### 调试工具
- 项目内置调试页面，可以手动测试各个功能
- 支持任务状态查询和回调模拟

### 注意事项

1. **API限制**: 注意SUNO AI的调用频率限制
2. **超时处理**: 音乐生成可能需要较长时间，做好超时处理
3. **存储管理**: 定期清理过期的音乐文件和数据库记录
4. **错误监控**: 建立完善的错误监控和报警机制

### 扩展功能

#### 已实现的扩展功能
- 多种生成模式支持
- 实时状态更新
- 音乐历史记录
- 错误重试机制

#### 可扩展的功能
- 音乐分享功能
- 用户收藏系统
- 音乐分类管理
- 批量生成支持

---

**文档版本**: v1.0  
**最后更新**: 2024年1月  
**维护者**: 项目开发团队