import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { clerkClient } from '../clerk.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const newsletterPath = path.join(__dirname, '../../../../data/newsletter.json');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      userId, 
      title, 
      content, 
      tags = [],
      files = []
    } = req.body;

    const user = await clerkClient.users.getUser(userId);
    const role = user.publicMetadata.role;
    
    if (role !== 'admin' && role !== 'lead') {
      return res.status(403).json({ error: 'Unauthorized: Only admin and lead roles can create newsletter posts' });
    }

    const data = await fs.readFile(newsletterPath, 'utf8');
    const newsletter = JSON.parse(data);

    const post = {
      id: Date.now().toString(),
      title,
      content,
      tags,
      authorId: userId,
      authorName: `${user.firstName} ${user.lastName}`,
      date: new Date().toISOString(),
      files: []
    };

    if (files && files.length > 0) {
      for (const file of files) {
        const fileId = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
        const fileData = file.content.split(';base64,').pop();

        newsletter.files[fileId] = {
          name: file.name,
          type: file.type,
          authorId: userId,
          postId: post.id,
          uploadDate: new Date().toISOString()
        };

        const buffer = Buffer.from(fileData, 'base64');
        await fs.mkdir(path.dirname(newsletterPath), { recursive: true });
        
        post.files.push({
          id: fileId,
          name: file.name,
          type: file.type
        });
      }
    }

    newsletter.posts.unshift(post);

    await fs.writeFile(newsletterPath, JSON.stringify(newsletter, null, 2));

    res.status(201).json({ success: true, post });
  } catch (error) {
    console.error('Error creating newsletter post:', error);
    res.status(500).json({ error: 'Failed to create newsletter post' });
  }
}
