import {
  COMMUNITY_ID,
  SHARE_PLATFORM,
  TASK_BROWSE,
  TASK_LIKE,
  TASK_SHARE,
  TASK_SIGNIN,
} from '../const.ts';
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

interface Post {
  postId?: string | number;
  selfOperation?: {
    liked?: boolean;
  };
}

interface RecommendPostResponse {
  posts?: Post[];
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

type TaskMap = Map<string, UserTask>;

export const runSignIn = async (client: ApiClient): Promise<void> => {
  const tasks = await runSection('获取任务列表', () => refreshTasks(client), new Map());
  let postsSeen: Post[] | undefined;

  await runSection('社区签到', () => doCommunitySignIn(client, tasks));
  postsSeen = await runSection('社区浏览', () => doBrowse(client, tasks));
  await runSection('社区点赞', () => doLike(client, tasks, postsSeen));
  await runSection('社区分享', () => doShare(client, tasks, postsSeen?.[0]));
  await runSection('游戏签到', () => doGameSignIn(client));
};

const runSection = async <T>(
  name: string,
  task: () => Promise<T>,
  fallback?: T,
): Promise<T | undefined> => {
  try {
    return await task();
  } catch (error) {
    markError();
    console.error(`   ${name}失败: ${getErrorMessage(error)}`);
    return fallback;
  }
};

const doCommunitySignIn = async (client: ApiClient, tasks?: TaskMap): Promise<void> => {
  console.log('-> 社区签到');

  if (remaining(tasks, TASK_SIGNIN) === 0) {
    console.log('   今日已签到，跳过');
    return;
  }

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

const doBrowse = async (client: ApiClient, tasks?: TaskMap): Promise<Post[] | undefined> => {
  const count = remaining(tasks, TASK_BROWSE) ?? 5;

  if (count === 0) {
    console.log('-> 社区浏览: 今日已完成，跳过');
    return undefined;
  }

  console.log(`-> 社区浏览 (剩余 ${count} 篇)`);

  const posts = await fetchPosts(client);
  const picked = posts.slice(0, count);

  if (posts.length < count) {
    console.log(`   推荐流仅 ${posts.length} 篇`);
  }

  for (const post of picked) {
    const postId = post.postId;
    if (!postId) {
      continue;
    }

    try {
      await client.nativeGet('bbs/api/getPostFull', { postId });
      console.log(`   阅读 postId=${postId}`);
    } catch (error) {
      markError();
      console.error(`   阅读 postId=${postId} 失败: ${getErrorMessage(error)}`);
    }

    await Bun.sleep(randomInt(700, 1500));
  }

  return picked;
};

const doLike = async (client: ApiClient, tasks?: TaskMap, candidates?: Post[]): Promise<void> => {
  const count = remaining(tasks, TASK_LIKE) ?? 5;

  if (count === 0) {
    console.log('-> 社区点赞: 今日已完成，跳过');
    return;
  }

  console.log(`-> 社区点赞 (剩余 ${count} 篇)`);

  const posts = candidates?.length ? candidates : await fetchPosts(client);
  const todo = posts.filter(post => !post.selfOperation?.liked);

  if (todo.length < count) {
    console.log(`   未点赞候选仅 ${todo.length} 篇`);
  }

  let liked = 0;
  for (const post of todo) {
    if (liked >= count) {
      break;
    }

    const postId = post.postId;
    if (!postId) {
      continue;
    }

    try {
      await client.nativePost('bbs/api/post/like', { postId });
      console.log(`   点赞 postId=${postId}`);
      liked += 1;
    } catch (error) {
      markError();
      console.error(`   点赞 postId=${postId} 失败: ${getErrorMessage(error)}`);
    }

    await Bun.sleep(randomInt(500, 1000));
  }
};

const doShare = async (client: ApiClient, tasks?: TaskMap, candidate?: Post): Promise<void> => {
  if (remaining(tasks, TASK_SHARE) === 0) {
    console.log('-> 社区分享: 今日已完成，跳过');
    return;
  }

  console.log('-> 社区分享 1 篇');

  const post = candidate ?? (await fetchPosts(client, 5))[0];
  const postId = post?.postId;

  if (!postId) {
    markError();
    console.error('   无可分享帖子');
    return;
  }

  await client.nativePost('bbs/api/post/share', {
    platform: SHARE_PLATFORM,
    postId,
  });
  console.log(`   分享 postId=${postId}`);
};

const doGameSignIn = async (client: ApiClient): Promise<void> => {
  console.log('-> 游戏签到');

  const cards = await fetchGameCards(client);
  if (cards.length === 0) {
    console.log('   无绑定游戏角色');
    return;
  }

  for (const card of cards) {
    await runSection(card.gameName || `gid=${card.gameId ?? '-'}`, () =>
      signGameCard(client, card),
    );
  }
};

const signGameCard = async (client: ApiClient, card: GameCard): Promise<void> => {
  const gameId = card.gameId;
  const gameName = card.gameName || `gid=${gameId}`;
  const role = card.bindRoleInfo;

  if (!gameId || !role?.roleId) {
    console.log(`   ${gameName}: 未绑定角色，跳过`);
    return;
  }

  const state = await client.h5Get<GameSignState>('apihub/awapi/signin/state', {
    gameId,
  });

  if (state.todaySign) {
    console.log(
      `   ${gameName}(${role.roleName || role.roleId}): 今日已签到 (本月累计 ${state.days ?? 0} 天)`,
    );
    return;
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
      return;
    }

    throw error;
  }
};

const fetchPosts = async (client: ApiClient, count = 20): Promise<Post[]> => {
  const data = await client.nativeGet<RecommendPostResponse>('bbs/api/getRecommendPostList', {
    communityId: COMMUNITY_ID,
    count,
    page: 1,
  });

  return data.posts ?? [];
};

const refreshTasks = async (client: ApiClient): Promise<TaskMap> => {
  const data = await client.nativeGet<TaskListResponse>('apihub/api/getUserTasks', { gid: '1' });
  const tasks = new Map<string, UserTask>();

  for (const task of data.task_list1 ?? []) {
    if (task.taskKey) {
      tasks.set(task.taskKey, task);
    }
  }

  return tasks;
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

const remaining = (tasks: TaskMap | undefined, taskKey: string): number | undefined => {
  const task = tasks?.get(taskKey);
  if (task?.limitTimes === undefined || task.completeTimes === undefined) {
    return undefined;
  }

  return Math.max(0, task.limitTimes - task.completeTimes);
};

const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;
