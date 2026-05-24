'use client';

import Image from 'next/image';
import useSWR from 'swr';

interface UIElement {
  id: string;
  key: string;
  name: string;
  image_url: string;
  link_url?: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function UIElements() {
  const { data: elements } = useSWR<UIElement[]>(
    '/api/web-images?category=ui_element',
    fetcher,
    { refreshInterval: 60000 }
  );
  
  // Filter elements that have images
  const uiElements = elements?.filter(el => el.image_url && el.image_url.length > 0) || [];

  if (uiElements.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-3 justify-center">
      {uiElements.map((element) => (
        <div key={element.id} className="relative">
          {element.link_url ? (
            <a href={element.link_url} target="_blank" rel="noopener noreferrer">
              <Image
                src={element.image_url}
                alt={element.name}
                width={80}
                height={80}
                className="object-contain hover:scale-110 transition-transform"
              />
            </a>
          ) : (
            <Image
              src={element.image_url}
              alt={element.name}
              width={80}
              height={80}
              className="object-contain"
            />
          )}
        </div>
      ))}
    </div>
  );
}
