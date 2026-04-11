# Platform Listing Guide

## 1. Smithery.ai (Done)

- URL: https://smithery.ai/server/j2c214c/ai-furniture-hub
- Status: Listed and public
- Update: Settings > General > Homepage URL

## 2. glama.ai

1. Go to https://glama.ai/mcp/servers
2. Click "Submit Server"
3. Enter GitHub URL: https://github.com/ONE8943/ai-furniture-hub
4. Fill in:
   - Name: AI Furniture Hub
   - Description: (copy from README first paragraph)
   - Categories: Shopping, Home, Tools
5. Submit and wait for review

## 3. npm

```bash
# Login to npm (first time only)
npm login

# Publish (scoped package, public)
npm publish --access public
```

After publishing, users can run:
```bash
npx @one-inc/ai-furniture-hub
```

## 4. Product Hunt

1. Go to https://www.producthunt.com/posts/new
2. Details:
   - Name: AI Furniture Hub
   - Tagline: "10 MCP tools for mm-precision furniture search, powered by AI agents"
   - Description: (use README content)
   - Topics: Artificial Intelligence, Developer Tools, Home
   - Link: https://github.com/ONE8943/ai-furniture-hub
3. Schedule launch for a Tuesday (best day for PH)

## 5. MCP Registry (mcp.run)

1. Go to https://mcp.run
2. Register server with GitHub URL
3. Provide server-card.json URL: https://ai-furniture-hub.onrender.com/.well-known/mcp/server-card.json

## Checklist Before Listing

- [x] README in English with badges
- [x] llms.txt and llms-full.txt up to date
- [x] server-card.json with all 10 tools
- [x] CI passing (GitHub Actions)
- [x] Live deployment (Render.com)
- [ ] npm publish
- [ ] glama.ai submission
- [ ] Product Hunt launch
