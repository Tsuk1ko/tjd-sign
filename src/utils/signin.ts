import { COMMUNITY_ID } from '../const.ts';
import type { ApiClient } from './client.ts';
import { getErrorMessage, markError } from './error-state.ts';

interface TaskListResponse {
  task_list1?: UserTask[];
  task_list2?: UserTask[];
}

interface UserTask {
  taskKey?: string;
  completeTimes?: number;
  limitTimes?: number;
  uid?: string | number;
}

interface CoinReward {
  goldCoin?: number;
  exp?: number;
}

interface GameRole {
  roleId?: string | number;
  roleName?: string;
}

interface GameCard {
  gameId?: string | number;
  gameName?: string;
  bindRoleInfo?: GameRole;
}

interface GameSignState {
  todaySign?: boolean;
  days?: number;
}

export const runSignIn = async (client: ApiClient): Promise<void> => {
  await runSection('社区签到', () => doCommunitySignIn(client));
  await runSection('游戏签到', () => doGameSignIn(client));
};

const runSection = async (name: string, task: () => Promise<void>): Promise<void> => {
  try {
    await task();
  } catch (error) {
    markError();
    console.error(`   ${name}失败: ${getErrorMessage(error)}`);
  }
};

const doCommunitySignIn = async (client: ApiClient): Promise<void> => {
  console.log('-> 社区签到');

  try {
    const reward = await client.nativePost<CoinReward>('apihub/api/signin', {
      communityId: COMMUNITY_ID,
    });
    console.log(`   签到成功 +${reward.goldCoin ?? 0}金币 +${reward.exp ?? 0}经验`);
  } catch (error) {
    const message = getErrorMessage(error);

    if (message.includes('已签') || message.includes('签到过')) {
      console.log('   今日已签到');
      return;
    }

    throw error;
  }
};

const doGameSignIn = async (client: ApiClient): Promise<void> => {
  console.log('-> 游戏签到');

  const cards = await fetchGameCards(client);
  if (cards.length === 0) {
    console.log('   无绑定游戏角色');
    return;
  }

  for (const card of cards) {
    const gameId = card.gameId;
    const gameName = card.gameName || `gid=${gameId}`;
    const role = card.bindRoleInfo;

    if (!gameId || !role?.roleId) {
      console.log(`   ${gameName}: 未绑定角色，跳过`);
      continue;
    }

    const state = await client.h5Get<GameSignState>('apihub/awapi/signin/state', {
      gameId,
    });

    if (state.todaySign) {
      console.log(
        `   ${gameName}(${role.roleName || role.roleId}): 今日已签到 (本月累计 ${state.days ?? 0} 天)`,
      );
      continue;
    }

    try {
      await client.h5Post('apihub/awapi/sign', {
        gameId,
        roleId: role.roleId,
      });
      console.log(`   ${gameName}(${role.roleName || role.roleId}): 签到成功`);
    } catch (error) {
      const message = getErrorMessage(error);

      if (message.includes('已签') || message.includes('签到过')) {
        console.log(`   ${gameName}: 已签到`);
        continue;
      }

      throw error;
    }
  }
};

const fetchGameCards = async (client: ApiClient): Promise<GameCard[]> => {
  const accountUid = await getAccountUid(client);
  if (!accountUid) {
    return [];
  }

  return client.nativeGet<GameCard[]>('apihub/api/getGameRecordCard', { uid: accountUid });
};

const getAccountUid = async (client: ApiClient): Promise<string | null> => {
  if (client.session.accountUid) {
    return client.session.accountUid;
  }

  const tasks = await client.nativeGet<TaskListResponse>('apihub/api/getUserTasks', { gid: '1' });
  const taskLists = [...(tasks.task_list1 ?? []), ...(tasks.task_list2 ?? [])];
  const uid = taskLists.find(task => task.uid)?.uid;

  if (!uid) {
    return null;
  }

  client.session.accountUid = String(uid);
  return client.session.accountUid;
};
