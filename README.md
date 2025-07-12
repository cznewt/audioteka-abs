# audioteka-abs

Audiobookshelf Custom Metadata Provider for Audioteka.com. 

It supports Polish and Czech sites.

Docker registry: https://github.com/cznewt/audioteka-abs/pkgs/container/audioteka-abs

## Screenshots

### List of matches

![image](https://github.com/user-attachments/assets/411b5897-38cf-4c31-bb1c-4b4dfb62d02c)
![image](https://github.com/user-attachments/assets/d470bb59-9d42-4c32-a65c-2f14b81cc71b)


### View of matched data

![image](https://github.com/user-attachments/assets/68828be1-fc74-4c08-b44b-b6977c497df4)


## Fetching features

- Cover
- Title
- Author
- Publisher
- Series
- Genres
- Language
- Description
- **Lectors**
- **Audiobook cover**

## Instructions to run locally

### Prerequisites

Docker and Docker Compose installed on your system

### Setup and running

1. Create or copy from girhub a compose.yml file in your desired directory with the following content

```
---
services:
  audioteka-abs:
    image: ghcr.io/cznewt/audioteka-abs:main
    container_name: audioteka-abs
    environment:
      - LANGUAGE=cz # For Polish users: Change enviorment line to - LANGUAGE=pl
      - ADD_AUDIOTEKA_LINK_TO_DESCRIPTION=true # Optional: Set to 'false' to remove the Audioteka link from the description
    restart: unless-stopped
    ports:
      - "3001:3001"
```

2. Pull the latest Docker images

```
docker-compose pull
```

3. Start the application

```
docker-compose up -d
```


### Updating the Application

To update to the latest version:

```
docker-compose pull
docker-compose up -d
```

### To stop the application

```
docker-compose down
```

### To view logs

```
docker-compose logs -f
```

## How to use in AudiobookShelf

1. Navigate to your AudiobookShelf settings
2. Navigate to Item Metadata Utils
3. Navigate to Custom Metadata Providers
4. Click on Add
5. Name: whatever for example AudioTeka
6. URL: http://your-ip:3001
7. Authorization Header Value: whatever, but not blank, for example 00000
8. Save

![image](https://github.com/user-attachments/assets/39ab7936-0b48-4a61-b418-840d02855522)
