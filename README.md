# 想集 ThinkAll

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9+-green.svg)](https://www.python.org/)
[![React 18](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![Flask 3](https://img.shields.io/badge/Flask-3-black.svg)](https://flask.palletsprojects.com/)

> A full-featured OA system integrating finance management, workflow approval, data visualization, instant messaging, and organizational structure management. Administrators can customize and design various functional modules to meet business needs.
>
> 集成财务系统、流程审批、数据可视化、即时聊天、组织架构管理于一体的综合 OA 系统。管理员可自由设计和配置各类功能模块，灵活适应企业需求。

想集 ThinkAll 是一款面向企业级用户的OA智能办公平台，提供全方位的OA功能，目前正在逐步开发建设，欢迎体验，提建议。

***

## 核心功能

- **多数据源管理** — MySQL 等数据库接入，SQL 查询与数据预览
- **可视化图表设计** — 柱状图、折线图、饼图、雷达图、面积图、散点图、表格等 12+ 图表类型
- **仪表板搭建** — 拖拽式布局、筛选器、图表联动
- **仪表板发布** — 公开访问 / 权限控制两种模式
- **故事板演示** — 幻灯片式播放、全屏模式、自动播放
- **RBAC 权限体系** — 6 级角色、功能权限、数据权限、图表可见性权限
- **分析说明** — 动态字段占位符、统计聚合、分组统计、关联统计
- **图表下钻** — 点击图表元素自动打开目标图表并传递筛选条件
- **企业通讯录** — 部门 + 人员树形结构
- **即时通讯** — 一对一聊天、文件传输、已读未读标识

## 开发规划

以下功能敬请期待，后续逐步更新开发：

- **财务管理系统** — 费用报销、预算管理、财务报表、收支统计
- **流程审批引擎** — 可视化流程设计、多级审批、审批跟踪、催办提醒
- **文档管理** — 文档在线编辑、版本控制、权限管理、全文检索
- **日程与会议** — 日程管理、会议室预约、会议纪要、日历视图
- **公告与通知** — 企业公告发布、已读未读跟踪、定时推送
- **任务管理** — 任务分配与跟踪、看板视图、甘特图、进度汇报
- **考勤管理** — 打卡签到、请假审批、加班统计、考勤报表
- **移动端适配** — 响应式布局、移动端审批、消息推送
- **数据大屏** — 大屏可视化模板、实时数据刷新、多屏适配
- **系统集成** — 第三方系统对接、单点登录（SSO）、数据同步

***

## 安装与使用

### 前置条件

- **Python 3.9+**
- **Node.js 18+**（Node.js 是必要环境，后端启动时会自动构建前端）
- **MySQL 5.7+**（推荐 8.0+）

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/xiweiguang/ThinkAll.git
   cd ThinkAll
   ```
2. **配置环境变量**
   ```bash
   copy .env.example .env
   ```
   然后编辑 `.env` 文件，填入数据库连接信息。
3. **安装后端依赖**
   ```bash
   pip install -r server/requirements.txt
   ```
4. **启动后端服务**
   ```bash
   python server/app.py
   ```
   首次启动会自动构建前端并初始化数据库。
5. **登录系统**
   - 默认账号：`admin`
   - 默认密码：`admin123`
   - 访问地址：<http://localhost:3001>

### 生产环境部署

设置以下环境变量：

```
SERVE_FRONTEND=true
FLASK_DEBUG=false
```

***

## 技术栈

| 层级  | 技术                                           |
| --- | -------------------------------------------- |
| 前端  | React 18 + Ant Design 5 + ECharts 6 + Vite 5 |
| 后端  | Flask 3 + PyMySQL + DBUtils + PyJWT          |
| 数据库 | MySQL 5.7+（推荐 8.0+）                          |

***

## 许可证

本项目基于 [Apache License 2.0](LICENSE) 开源。

***

## 贡献指南

欢迎贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何提交代码。

所有 Pull Request 需经项目维护者审查后才能合并。维护者保留根据代码质量、架构一致性等因素自行决定是否合并的权利。

***

## 作者

- **xiweiguang** - *AI development* - <https://github.com/xiweiguang/ThinkAll>

## 致谢

- 感谢所有为本项目做出贡献的开发者
- 感谢大家多提想法

