const express = require('express');
const { isExclusiveAdManager } = require('./restrictedPermissions');

const ROOMS = [
  { id: 'training-1', name: '교육실 1' },
  { id: 'training-2', name: '교육실 2' },
  { id: 'training-3', name: '교육실 3' },
  { id: 'conference', name: '대회의실' },
];
const ROOM_IDS = new Set(ROOMS.map(room => room.id));
const roomSelect = {
  id: true,
  userId: true,
  userName: true,
  userTeam: true,
  startedAt: true,
  revision: true,
  updatedAt: true,
};

function serializeRoom(room, user) {
  const definition = ROOMS.find(item => item.id === room.id);
  const isOccupied = Boolean(room.startedAt);
  return {
    ...room,
    name: definition.name,
    isOccupied,
    canStop: isOccupied && (room.userId === user.id || isExclusiveAdManager(user)),
  };
}

function storageNotReady(res) {
  return res.status(503).json({ error: '교육실 사용현황을 준비 중입니다. 관리자에게 문의해주세요.' });
}

function handleError(error, res) {
  if (error.code === 'P2021' || error.code === 'P2022') return storageNotReady(res);
  console.error('Room usage error:', error);
  return res.status(500).json({ error: '교육실 사용현황을 처리하지 못했습니다. 다시 시도해주세요.' });
}

function createRoomUsageRouter(prisma) {
  const router = express.Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/', async (req, res) => {
    if (!prisma.roomUsage) return storageNotReady(res);
    try {
      const rows = await prisma.roomUsage.findMany({
        where: { id: { in: [...ROOM_IDS] } },
        select: roomSelect,
      });
      const byId = new Map(rows.map(row => [row.id, row]));
      if (ROOMS.some(room => !byId.has(room.id))) return storageNotReady(res);
      return res.json({ rooms: ROOMS.map(room => serializeRoom(byId.get(room.id), req.user)) });
    } catch (error) {
      return handleError(error, res);
    }
  });

  router.post('/:roomId/:action', async (req, res) => {
    const { roomId, action } = req.params;
    if (!ROOM_IDS.has(roomId) || !['start', 'stop'].includes(action)) {
      return res.status(404).json({ error: '사용할 공간을 찾을 수 없습니다.' });
    }
    const revision = req.body?.revision;
    if (!Number.isInteger(revision) || revision < 0) {
      return res.status(400).json({ error: '공간 상태를 새로고침한 후 다시 시도해주세요.' });
    }
    if (!prisma.roomUsage) return storageNotReady(res);

    try {
      const room = await prisma.roomUsage.findUnique({ where: { id: roomId }, select: roomSelect });
      if (!room) return storageNotReady(res);
      if (action === 'stop' && !serializeRoom(room, req.user).canStop) {
        return res.status(room.startedAt ? 403 : 409).json({
          error: room.startedAt ? '사용 중인 직원 또는 cchee만 종료할 수 있습니다.' : '이미 사용이 종료된 공간입니다.',
        });
      }

      // Match the observed revision atomically so a stale click cannot affect a new session.
      const result = await prisma.roomUsage.updateMany({
        where: {
          id: roomId,
          revision,
          ...(action === 'start'
            ? { startedAt: null }
            : { startedAt: { not: null }, ...(!isExclusiveAdManager(req.user) ? { userId: req.user.id } : {}) }),
        },
        data: {
          ...(action === 'start'
            ? { userId: req.user.id, userName: req.user.name, userTeam: req.user.team, startedAt: new Date() }
            : { userId: null, userName: null, userTeam: null, startedAt: null }),
          revision: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        return res.status(409).json({ error: '다른 직원이 공간 상태를 변경했습니다. 최신 상태를 확인해주세요.' });
      }
      const updated = await prisma.roomUsage.findUnique({ where: { id: roomId }, select: roomSelect });
      return res.json({ room: serializeRoom(updated, req.user) });
    } catch (error) {
      return handleError(error, res);
    }
  });

  return router;
}

module.exports = { ROOMS, createRoomUsageRouter };
