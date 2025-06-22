import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { method, url, headers } = req;

  if (method === 'GET' && url.startsWith('/?id=')) {
    const id = new URL(`http://x.com${url}`).searchParams.get("id");
    if (!id) return res.status(400).send("Missing ID");
    const token = process.env.BOT_TOKEN;
    return res.redirect(`https://api.telegram.org/file/bot${token}/${id}`);
  }

  if (method !== 'POST') return res.status(200).end();

  const buffers = [];
  for await (const chunk of req) {
    buffers.push(chunk);
  }
  const rawBody = Buffer.concat(buffers).toString();
  const body = JSON.parse(rawBody);

  if (!body.message) return res.status(200).end();

  const token = process.env.BOT_TOKEN;
  const chat_id = body.message.chat.id;
  const message_id = body.message.message_id;
  const text = body.message.text;
  const caption = body.message.caption || '';
  const typeQuery = caption.includes("type=telegram") || (text && text.includes("type=telegram"));

  if (text === '/start') {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id,
        text: "👋 Welcome to the bot!\n📤 Send me an image or video and I’ll give you a link to view it!",
        reply_to_message_id: message_id
      })
    });
    return res.status(200).end();
  }

  const photo = body.message.photo;
  const video = body.message.video;

  if (photo || video) {
    const file_id = photo ? photo[photo.length - 1].file_id : video.file_id;

    const fileInfoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${file_id}`);
    const fileInfo = await fileInfoRes.json();

    if (!fileInfo.ok || !fileInfo.result || !fileInfo.result.file_path) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id,
          text: "❌ Failed to get file info. Please try again.",
          reply_to_message_id: message_id
        })
      });
      return res.status(200).end();
    }

    const file_path = fileInfo.result.file_path;
    const telegram_url = `https://api.telegram.org/file/bot${token}/${file_path}`;
    const vercel_url = `https://${headers.host}/?id=${encodeURIComponent(file_path)}`;
    const sendUrl = typeQuery ? telegram_url : vercel_url;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id,
        text: `🔗 Here is your link:\n${sendUrl}`,
        reply_to_message_id: message_id
      })
    });
  }

  res.status(200).end();
}
