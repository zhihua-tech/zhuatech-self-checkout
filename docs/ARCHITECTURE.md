# 架构说明
终端 UI 只负责采集扫码、称重和支付意图，领域层统一执行计价、防损与库存规则。演示版使用 JSON 快照；生产可替换为 MySQL 事务、Redis 幂等缓存、支付网关和硬件适配进程。

Copyright © 上海如静知华信息科技有限公司 · https://www.zhuatech.cn/
