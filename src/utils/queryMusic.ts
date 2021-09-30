import 'dotenv/config'
import { default as search,  } from 'youtube-search';
import type { YouTubeSearchResults } from 'youtube-search'

export default async function searchMusic(name: string): Promise<YouTubeSearchResults[]>{
    const query = await search(name, {
      key: process.env.YTKEY,
      maxResults: 5,
    })
  
    return query.results
}