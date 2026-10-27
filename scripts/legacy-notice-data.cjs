const crypto = require('node:crypto');

function parseLegacyNoticeDate(value) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value || '')) throw new Error(`Invalid legacy date: ${value}`);
  const date = new Date(`${value.replace(' ', 'T')}+09:00`);
  if (Number.isNaN(date.getTime()) || new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 19).replace('T', ' ') !== value) {
    throw new Error(`Invalid legacy date: ${value}`);
  }
  return date;
}

function communityContentText(node) {
  if (node.type === 'text') return node.text;
  if (node.type === 'hardBreak') return '\n';
  const separator = ['doc', 'bulletList', 'orderedList', 'listItem', 'blockquote'].includes(node.type) ? '\n' : '';
  return (node.content || []).map(communityContentText).join(separator);
}

function inspectAsset(buffer, fileName) {
  const hex = buffer.subarray(0, 12).toString('hex');
  let mimeType;
  if (hex.startsWith('89504e470d0a1a0a')) mimeType = 'image/png';
  else if (hex.startsWith('ffd8ff')) mimeType = 'image/jpeg';
  else if (/^GIF8[79]a/.test(buffer.subarray(0, 6).toString('ascii'))) mimeType = 'image/gif';
  else if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') mimeType = 'image/webp';
  else if (hex.startsWith('d0cf11e0a1b11ae1') && /\.xls$/i.test(fileName)) mimeType = 'application/vnd.ms-excel';
  else if ((hex.startsWith('504b0304') || hex.startsWith('efbbbf504b0304')) && /\.docx$/i.test(fileName)) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  else throw new Error(`Unsupported or invalid asset: ${fileName}`);
  return { id: crypto.createHash('sha256').update(buffer).digest('hex'), mimeType, byteSize: buffer.length };
}

function resolveNoticeAuthor(authorName, users) {
  const matches = users.filter(user => user.name === authorName);
  return matches.length === 1 ? matches[0].id : null;
}

module.exports = { parseLegacyNoticeDate, communityContentText, inspectAsset, resolveNoticeAuthor };
