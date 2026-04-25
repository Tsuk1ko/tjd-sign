# tjd-sign

塔吉多社区每日签到，重写自 [SkyBlue997/tjd-daily](https://github.com/SkyBlue997/tjd-daily)

使用塔吉多账号密码登录，自动缓存 token 和设备指纹，并完成社区签到与全部已绑定游戏角色签到。

## ENV

| Name           | Value                    |
| -------------- | ------------------------ |
| `TJD_ACCOUNT`  | 塔吉多账号，通常是手机号 |
| `TJD_PASSWORD` | 塔吉多账号密码           |

## 使用

创建 `.env`，写入环境变量

```bash
bun install
bun start
```
