import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import db from '@/lib/db.server';

/**
 * GET /api/playrecords
 * 返回当前用户的播放记录（服务器端）
 */
export async function GET(request: NextRequest) {
  const NO_CACHE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, private, max-age=0, s-maxage=0',
    Pragma: 'no-cache',
    Expires: '0',
    Vary: 'Cookie',
  };

  try {
    // 从 cookie 获取用户信息
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    // 检查用户状态和执行迁移
    if (authInfo.username !== process.env.USERNAME) {
      // 非站长，检查用户存在或被封禁
      const userInfoV2 = await db.getUserInfoV2(authInfo.username);
      if (!userInfoV2) {
        return NextResponse.json({ error: '用户不存在' }, { status: 401, headers: NO_CACHE_HEADERS });
      }
      if (userInfoV2.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401, headers: NO_CACHE_HEADERS });
      }

      // 检查播放记录迁移标识，没有迁移标识时执行迁移
      if (!userInfoV2.playrecord_migrated) {
        console.log(`用户 ${authInfo.username} 播放记录未迁移，开始执行迁移...`);
        await db.migratePlayRecords(authInfo.username);
      }
    } else {
      // 站长也需要执行迁移（站长可能不在数据库中，直接尝试迁移）
      const userInfoV2 = await db.getUserInfoV2(authInfo.username);
      if (!userInfoV2 || !userInfoV2.playrecord_migrated) {
        console.log(`站长 ${authInfo.username} 播放记录未迁移，开始执行迁移...`);
        await db.migratePlayRecords(authInfo.username);
      }
    }

    const records = await db.getAllPlayRecords(authInfo.username);
    return NextResponse.json(records, { status: 200, headers: NO_CACHE_HEADERS });
  } catch (err) {
    console.error('获取播放记录失败', err);
    return NextResponse.json({ error: '获取播放记录失败' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}