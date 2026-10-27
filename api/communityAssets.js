const express = require('express');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const ASSET_PATH = /^\/api\/community\/assets\/([a-f0-9]{64})(?:\?[^#]*)?$/;
const INLINE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

function canonicalCommunityAssetUrl(value) {
  const match = String(value || '').match(ASSET_PATH);
  if (!match) return null;
  const download = new URLSearchParams(String(value).split('?')[1] || '').get('download') === '1';
  return `/api/community/assets/${match[1]}${download ? '?download=1' : ''}`;
}

function assetSecret(secret) {
  return crypto.createHmac('sha256', secret).update('community-assets-v1').digest();
}

function signCommunityAssetUrl(value, userId, secret) {
  const canonical = canonicalCommunityAssetUrl(value);
  if (!canonical) return value;
  const assetId = canonical.match(ASSET_PATH)[1];
  const token = jwt.sign({ assetId, userId }, assetSecret(secret), {
    algorithm: 'HS256', audience: 'community-assets', expiresIn: '2h',
  });
  return `${canonical}${canonical.includes('?') ? '&' : '?'}token=${token}`;
}

function signCommunityContentAssets(content, userId, secret) {
  if (!content || typeof content !== 'object') return content;
  const next = { ...content };
  if (content.type === 'image' && content.attrs?.src) {
    next.attrs = { ...content.attrs, src: signCommunityAssetUrl(content.attrs.src, userId, secret) };
  }
  if (content.marks) {
    next.marks = content.marks.map(mark => mark.type === 'link'
      ? { ...mark, attrs: { ...mark.attrs, href: signCommunityAssetUrl(mark.attrs?.href, userId, secret) } }
      : mark);
  }
  if (content.content) next.content = content.content.map(child => signCommunityContentAssets(child, userId, secret));
  return next;
}

function createCommunityAssetRouter(prisma, secret) {
  const router = express.Router();
  router.get('/:id', async (req, res) => {
    if (!/^[a-f0-9]{64}$/.test(req.params.id)) return res.sendStatus(404);
    let claims;
    try {
      claims = jwt.verify(String(req.query.token || ''), assetSecret(secret), {
        audience: 'community-assets', algorithms: ['HS256'],
      });
      if (claims.assetId !== req.params.id || !Number.isInteger(claims.userId)) return res.sendStatus(403);
    } catch {
      return res.sendStatus(401);
    }
    try {
      const user = await prisma.user.findUnique({ where: { id: claims.userId }, select: { status: true } });
      if (user?.status !== '재직') return res.sendStatus(403);
      const asset = await prisma.communityAsset.findUnique({ where: { id: req.params.id } });
      if (!asset) return res.sendStatus(404);
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Cache-Control', 'private, max-age=300');
      if (req.query.download === '1' || !INLINE_TYPES.has(asset.mimeType)) res.attachment(asset.fileName);
      res.type(asset.mimeType);
      const buffer = Buffer.from(asset.data);
      function* chunks() {
        for (let offset = 0; offset < buffer.length; offset += 256 * 1024) {
          yield buffer.subarray(offset, offset + 256 * 1024);
        }
      }
      // Keep large original images out of buffered function-response limits.
      res.flushHeaders();
      await pipeline(Readable.from(chunks()), res);
      return undefined;
    } catch (error) {
      if (res.headersSent) { res.destroy(); return undefined; }
      console.error('Fetch community asset error:', error.message);
      return res.status(500).json({ error: '첨부파일을 불러오지 못했습니다.' });
    }
  });
  return router;
}

module.exports = { canonicalCommunityAssetUrl, signCommunityAssetUrl, signCommunityContentAssets, createCommunityAssetRouter };
