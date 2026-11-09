<div align="center">
  <img src=".github/assets/lilbox.svg" height="200"/>
</div>

<h1 align="center" style="margin-top: -10px;"> HomeBox </h1>
<p align="center" style="width: 100%;">
    <img src="https://img.shields.io/github/check-runs/frozenbug-dev/homebox/main" alt="Github Checks"/>
    <img src="https://img.shields.io/github/license/frozenbug-dev/homebox"/>
</p>

> This is a fork of [sysadminsmedia/homebox](https://github.com/sysadminsmedia/homebox) with a reworked UI and additional fixes.

## What is HomeBox

HomeBox is the inventory and organization system built for the Home User! With a focus on simplicity and ease of use, Homebox is the perfect solution for your home inventory, organization, and management needs. While developing this project, We've tried to keep the following principles in mind:

- 🧘 _Simple but Expandable_ - Homebox is designed to be simple and easy to use. No complicated setup or configuration required. But expandable to whatever level of infrastructure you want to put into it.
- 🚀 _Blazingly Fast_ - Homebox is written in Go, which makes it extremely fast and requires minimal resources to deploy. In general, idle memory usage is less than 50MB for the whole container.
- 📦 _Portable_ - Homebox is designed to be portable and run on anywhere. We use SQLite and an embedded Web UI to make it easy to deploy, use, and backup.

### Key Features
- 📇 Rich Organization - Organize your items into categories, locations, and tags. You can also create custom fields to store additional information about your items.
- 🔍 Powerful Search - Quickly find items in your inventory using the powerful search feature.
- 📸 Image Upload - Upload images of your items to make it easy to identify them.
- 📄 Document and Warranty Tracking - Keep track of important documents and warranties for your items.
- 💰 Purchase & Maintenance Tracking - Track purchase dates, prices, and maintenance schedules for your items.
- 📱 Responsive Design - Homebox is designed to work on any device, including desktops, tablets, and smartphones.

## Screenshots
![Login Screen](.github/assets/1.png)
![Dashboard](.github/assets/2.png)
![Item View](.github/assets/3.png)
![Create Item](.github/assets/9.png)
![Search](.github/assets/8.png)

## Quick Start

Configuration options are documented in the [upstream docs](https://homebox.software/en/quick-start/).

```bash
# Save pepper to local file
openssl rand -base64 48 > hbox.pepper
chmod 400 hbox.pepper
# If using the rootless or hardened image, ensure data 
# folder has correct permissions
mkdir -p /path/to/data/folder
chown 65532:65532 -R /path/to/data/folder
docker run -d \
  --name homebox \
  --restart unless-stopped \
  --publish 3100:7745 \
  --env TZ=Europe/Bucharest \
  --env HBOX_AUTH_API_KEY_PEPPER=$(cat hbox.pepper) \
  --volume /path/to/data/folder/:/data \
  ghcr.io/frozenbug-dev/homebox:latest
# ghcr.io/frozenbug-dev/homebox:latest-rootless
# ghcr.io/frozenbug-dev/homebox:latest-hardened
```

## Credits
- Original project by [@hay-kot](https://github.com/hay-kot)
- Logo by [@lakotelman](https://github.com/lakotelman)
