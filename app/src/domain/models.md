Data models summary (Prisma):

- User: links Whop user to reachable identities (email, Telegram, Discord, Twitter, Instagram). Has many Events and Clicks.
- Event: stored webhook events; for success/failure, carries amounts/currency and recovery attribution fields.
- Click: tracks recovery link clicks per channel/messageId for attribution.




