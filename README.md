# AI Photobooth

AI Photobooth is a Node.js and Express activation app that receives participant photos, generates a World Cup-inspired collectible card and WhatsApp stickers with OpenAI image generation, stores the results in Firebase, sends them back through Twilio WhatsApp, and coordinates local printing.

The event root is derived from `PHOTOBOOTH_EVENT_ID`:

```text
/events/${eventId}
```

Storage objects use the same event id by default:

```text
events/${eventId}
```

## Example Output

### Main Card

The main card is composed as a 10 x 15 cm print asset with a generated participant cutout, a generated/background layer, and a top overlay frame.

![Example main card](docs/images/example-main-card.jpg)

### Stickers

Secondary outputs are generated as transparent sticker-style images and sent individually through WhatsApp.

![Example stickers](docs/images/example-stickers.jpg)

### Sticker Sheet

The sticker sheet is a 3.5 x 6 inch PNG used for physical sticker printing.

![Example sticker sheet](docs/images/example-sticker-sheet.jpg)

## What It Does

1. A participant sends an image to the configured Twilio WhatsApp sender.
2. The webhook immediately responds with a short "please wait" message.
3. The app saves the inbound message payload, profile data, original image, and optimized image in Firestore and Cloud Storage.
4. The app generates the main card first.
5. The main card is sent back to the participant on WhatsApp.
6. The secondary stickers are generated in parallel.
7. Each sticker is sent back individually as a 512 x 512 WebP.
8. A sticker sheet PNG is generated for printing.
9. Firestore print requests are created when the event-level auto-print flags are enabled.
10. A local print worker picks up print requests and sends them to the appropriate local workflow.

## Public Interfaces

- `/generator/`: local/manual generator with upload or webcam capture.
- `/manager`: authenticated management console for generated images, participants, regeneration, comparing originals, and print queue control.
- `/search/`: authenticated iPad-friendly search page for finding participant images by phone number and manually sending card or sticker print requests.
- `/photobooth/`: early public camera prototype and lenticular calibration surface.
- `/api/photobooth/whatsapp`: Twilio WhatsApp webhook endpoint.
- `/api/photobooth/whatsapp/webhook`: equivalent WhatsApp webhook endpoint.
- `/health`: health check.

## Data Model

All activation data lives below `/events/${eventId}`.

- `images`: one document per received or generated package. For WhatsApp, the document ID is the inbound message SID.
- `profiles`: one document per participant phone number. The ID is an MD5 hash of the cleaned WhatsApp number.
- `prints`: one document per print request, using `{imageId}_main` or `{imageId}_stickers`.

Important event-level fields:

```json
{
  "printLimitPerProfile": 5,
  "autoPrintMainOnReady": true,
  "autoPrintStickerSheetOnReady": true
}
```

- `printLimitPerProfile`: maximum number of image packages a participant can submit unless their profile has `unlimited: true`.
- `autoPrintMainOnReady`: when `true`, the app creates a card print request as soon as the main card is ready.
- `autoPrintStickerSheetOnReady`: when `true`, the app creates a sticker sheet print request as soon as the sheet is ready.

## Required Services

### Twilio

You need a Twilio account with WhatsApp messaging enabled.

Configure:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- Either `TWILIO_WHATSAPP_FROM` or `TWILIO_MESSAGING_SERVICE_SID`

In the Twilio Console, configure the WhatsApp inbound message webhook to your public server URL:

```text
POST https://YOUR_PUBLIC_DOMAIN/api/photobooth/whatsapp
```

The alternate path also works:

```text
POST https://YOUR_PUBLIC_DOMAIN/api/photobooth/whatsapp/webhook
```

For local development, expose port `3000` with a tunnel such as ngrok, Cloudflare Tunnel, or another HTTPS ingress, then paste the public HTTPS URL into the Twilio WhatsApp webhook configuration.

### Firebase

Firebase is used for Firestore, Cloud Storage, and browser authentication for `/manager` and `/search/`.

Configure a Firebase Admin service account:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`

Configure public Firebase web app values for authenticated browser pages:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_APP_ID`
- `FIREBASE_MESSAGING_SENDER_ID`

The authenticated users who operate `/manager` and `/search/` must exist in Firebase Auth.

### OpenAI

Image generation uses the OpenAI Images API.

Required:

- `OPENAI_API_KEY`

Optional:

- `OPENAI_IMAGE_MODEL`, default `gpt-image-1.5`
- `OPENAI_IMAGE_QUALITY`, default `high`
- `OPENAI_SOURCE_IMAGE_MAX_SIZE`, default `1024`
- `OPENAI_SOURCE_IMAGE_QUALITY`, default `82`
- `IMAGE_GENERATION_MODE=mock` for local UI tests without AI calls

## Local Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Start the Express server:

```bash
npm start
```

Run the syntax check:

```bash
npm run check
```

The default server URL is:

```text
http://localhost:3000
```

## Environment Variables

Core:

```bash
PORT=3000
PHOTOBOOTH_EVENT_ID=your-event-id
PHOTOBOOTH_STORAGE_ROOT=
PHOTOBOOTH_PRINT_LIMIT_PER_PROFILE=1
PHOTOBOOTH_AUTO_PRINT_ON_GENERATION=false
WHATSAPP_MAIN_IMAGE_MAX_SIZE=1400
```

When `PHOTOBOOTH_STORAGE_ROOT` is empty, Storage defaults to `events/${eventId}`.

AI:

```bash
IMAGE_GENERATION_MODE=openai
OPENAI_API_KEY=...
OPENAI_IMAGE_MODEL=gpt-image-1.5
```

Twilio:

```bash
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+5500000000000
TWILIO_MESSAGING_SERVICE_SID=
```

Firebase:

```bash
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=...
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_APP_ID=...
FIREBASE_MESSAGING_SENDER_ID=...
```

Printing:

```bash
PRINTER_NAME=PRINTER
PRINTER_PAPER_SIZE=(6x4)
PRINTER_ORIENTATION=portrait
PRINTER_TESTING=true
PRINT_MAIN_ENABLED=true
PRINT_STICKERS_ENABLED=true
PRINTER_POLL_INTERVAL_MS=3000
```

Card composition:

```bash
MAIN_CARD_COMPOSITION={"background":"#000d25","imageLeft":90,"imageTop":82,"imageWidth":990,"imageHeight":1485,"imageFit":"contain"}
MAIN_CARD_BACKGROUND_IMAGE_PATH=server/assets/background.png
MAIN_CARD_OVERLAY_PATH=server/assets/mask.png
```

The main composition can also be saved in Firestore through `/generator/` or `/manager`; Firestore settings take precedence for future generations.

## Printing

Printing has two independent paths.

### Main Card Printing

Main card printing uses `pdf-to-printer` and is intended to run only on a Windows machine connected to the photo printer.

Operational notes:

- The printed asset is the card image prepared for 10 x 15 cm output.
- `PRINT_MAIN_ENABLED=true` allows this machine to process card print jobs.
- `PRINTER_NAME`, `PRINTER_PAPER_SIZE`, and `PRINTER_ORIENTATION` must match the Windows printer driver.
- Use `PRINTER_TESTING=true` to generate PDFs without sending them to the printer.

### Sticker Sheet Printing

Sticker sheet printing uses the Liene PixCut S1 workflow.

Operational notes:

- `PRINT_STICKERS_ENABLED=true` allows this machine to download sticker sheets.
- The worker downloads sticker sheet PNGs into `scripts/pending`.
- Print those files with the Liene PixCut S1 workflow.
- After a sheet is printed, move the file into `scripts/printed`.
- The worker detects the moved file, marks the Firestore print request as printed, and notifies the participant on WhatsApp.

Start the worker:

```bash
npm run printer
```

The printer worker reads the same root `.env`. It can also read `scripts/.env` when running directly from the `scripts` folder.

## Running an Activation

1. Set the `.env` values for OpenAI, Twilio, Firebase, and printing.
2. Start the server with `npm start`.
3. Expose the server publicly over HTTPS.
4. Configure the Twilio WhatsApp webhook to `POST /api/photobooth/whatsapp`.
5. Open `/manager`, sign in with Firebase Auth, and confirm event settings.
6. Set `/events/${eventId}.autoPrintMainOnReady` and `/events/${eventId}.autoPrintStickerSheetOnReady` as needed.
7. Start `npm run printer` on the local print workstation.
8. For card printing, use a Windows machine with the photo printer configured.
9. For sticker printing, use the Liene PixCut S1 machine/workflow and move completed sheets from `scripts/pending` to `scripts/printed`.
10. Ask participants to send a photo to the Twilio WhatsApp number.

## Management Notes

- `/manager` separates images and participants into tabs.
- Failed generations can be regenerated.
- The manager can compare the original image and generated card.
- The manager can manually queue card or sticker printing.
- Participant profiles can be marked `unlimited` to bypass the per-profile limit.
- `/search/` is installable on iPad as a web app and is designed for phone-number lookup at the event.

## Project Structure

```text
server/
  src/
    index.js                  Express routes
    services/
      generatedImages.js      OpenAI generation, card composition, sticker sheet creation
      whatsappPhotobooth.js   Twilio webhook, Firestore records, WhatsApp delivery
      printQueue.js           Local print queue sync and print completion notifications
      firebaseAdmin.js        Firebase Admin and Storage helpers
      twilioWhatsApp.js       Twilio client helpers
  public/
    generator/                Manual generator UI
    manager.html              Management console
    search.html               iPad search UI
    photobooth/               Camera/lenticular prototype
scripts/
  printer.js                  Local print worker
  pending/                    Sticker sheets waiting for Liene PixCut S1 printing
  printed/                    Printed sticker sheets, used as completion signal
docs/images/                  README example images
```

## Generated Files

Runtime output is intentionally ignored by git:

- `server/public/generated/`
- `scripts/pending/`
- `scripts/printed/`
- `scripts/printings/`
- `.env`

The README images in `docs/images/` are small, static examples copied from generated output for documentation only.
