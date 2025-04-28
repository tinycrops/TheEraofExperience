// To run this code you need to install the following dependencies:
// npm install @google/genai mime
// npm install -D @types/node

import {
    GoogleGenAI,
  } from '@google/genai';
  
  async function main() {
    const ai = new GoogleGenAI({
    });
    const tools = [
      { googleSearch: {} },
    ];
    const config = {
      tools,
      responseMimeType: 'text/plain',
    };
    const model = 'gemini-2.0-flash';
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `tell me some nice places to visit in Rochester NY`,
          },
        ],
      },
      {
        role: 'model',
        parts: [
          {
            text: `Rochester, NY, offers a variety of attractions and activities. Here are a few ideas for places to visit:
  
  **Museums & Historical Sites:**
  
  *   **The Strong National Museum of Play:** This interactive museum is great for all ages and includes the National Toy Hall of Fame, a butterfly garden, and arcade games.
  *   **George Eastman Museum:** The world's oldest photography museum, located on the estate of George Eastman, the founder of Kodak.
  *   **Susan B. Anthony Museum & House:** Learn about the life and work of the women's rights leader.
  *   **Rochester Museum & Science Center (RMSC):** Offers interactive exhibits and activities for the whole family. It also houses the Strasenburgh Planetarium.
  *   **Genesee Country Village & Museum:** A living history museum that depicts 19th-century life in New York State.
  *   **Seneca Art & Culture Center at Ganondagan:** Learn about the Seneca Nation and their culture.
  
  **Parks & Nature:**
  
  *   **High Falls:** A majestic waterfall located in the heart of downtown Rochester.
  *   **Lower Falls:** The largest waterfall along the Genesee River.
  *   **Ontario Beach Park:** Offers a sandy beach, boardwalk, carousel, and pier along Lake Ontario.
  *   **Durand Eastman Park:** Features golf, cross-country skiing, and scenic views along Lake Ontario.
  *   **Highland Park:** Known for its spring Lilac Festival and beautiful gardens.
  *   **Seneca Park Zoo:** Home to over 90 species of animals from around the world.
  *   **Turning Point Park:** Offers a boardwalk with views of the Genesee River.
  *   **Cobb's Hill Park:** A good spot to watch the sunset.
  *   **Mount Hope Cemetery:** A historic Victorian cemetery.
  
  **Activities & Entertainment:**
  
  *   **Seabreeze Amusement Park:** An amusement park with rides and a water park.
  *   **Genesee Brew House:** Enjoy local beer with a view of High Falls.
  *   **Erie Canal Cruise:** Explore the historic Erie Canal.
  *   **Rochester and Genesee Valley Railroad Museum:** Learn about the impact of the railroad on the region and ride an antique train.
  
  **Other:**
  
  *   **Public Market:** A vibrant market with food and local goods.
  *   **Craft Breweries:** Rochester has many craft breweries with unique taproom spaces.
  `,
          },
        ],
      },
      {
        role: 'user',
        parts: [
          {
            text: `INSERT_INPUT_HERE`,
          },
        ],
      },
    ];
  
    const response = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });
    for await (const chunk of response) {
      console.log(chunk.text);
    }
  }
  
  main();
  