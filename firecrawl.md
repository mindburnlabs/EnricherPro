# Agent

> Gather data wherever it lives on the web. Describe what you want, /agent handles the rest.

Firecrawl `/agent` is a magic API that searches, navigates, and gathers data from even the most complex websites, finding data in hard-to-reach places and discovering data anywhere on the internet. It accomplishes in a few minutes what would take a human many hours, and makes traditional web scraping obsolete.

**Just describe what data you want and `/agent` handles the rest.**

<Info>
  **Research Preview**: Agent is in early access. Expect rough edges. It will get significantly better over time. [Share feedback →](mailto:product@firecrawl.com)
</Info>

Agent builds on everything great about `/extract` and takes it further:

* **No URLs Required**: Just describe what you need via `prompt` parameter. URLs are optional.
* **Deep Web Search**: Autonomously searches and navigates deep into sites to find your data
* **Reliable and Accurate**: Works with a wide variety of queries and use cases
* **Faster**: Processes multiple sources in parallel for quicker results
* **Cheaper**: Agent is more cost-effective than `/extract` for complex use cases

## Using `/agent`

The only required parameter is `prompt`. Simply describe what data you want to extract. For structured output, provide a JSON schema. The SDKs support Pydantic (Python) and Zod (Node) for type-safe schema definitions:

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import FirecrawlApp
  from pydantic import BaseModel, Field
  from typing import List, Optional

  app = FirecrawlApp(api_key="fc-YOUR_API_KEY")

  class Founder(BaseModel):
      name: str = Field(description="Full name of the founder")
      role: Optional[str] = Field(None, description="Role or position")
      background: Optional[str] = Field(None, description="Professional background")

  class FoundersSchema(BaseModel):
      founders: List[Founder] = Field(description="List of founders")

  result = app.agent(
      prompt="Find the founders of Firecrawl",
      schema=FoundersSchema
  )

  print(result.data)
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';
  import { z } from 'zod';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR_API_KEY" });

  const result = await firecrawl.agent({
    prompt: "Find the founders of Firecrawl",
    schema: z.object({
      founders: z.array(z.object({
        name: z.string().describe("Full name of the founder"),
        role: z.string().describe("Role or position").optional(),
        background: z.string().describe("Professional background").optional()
      })).describe("List of founders")
    })
  });

  console.log(result.data);
  ```

  ```bash cURL theme={null}
  curl -X POST "https://api.firecrawl.dev/v2/agent" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "prompt": "Find the founders of Firecrawl",
      "schema": {
        "type": "object",
        "properties": {
          "founders": {
            "type": "array",
            "description": "List of founders",
            "items": {
              "type": "object",
              "properties": {
                "name": { "type": "string", "description": "Full name" },
                "role": { "type": "string", "description": "Role or position" },
                "background": { "type": "string", "description": "Professional background" }
              },
              "required": ["name"]
            }
          }
        },
        "required": ["founders"]
      }
    }'
  ```
</CodeGroup>

### Response

```json JSON theme={null}
{
  "success": true,
  "status": "completed",
  "data": {
    "founders": [
      {
        "name": "Eric Ciarla",
        "role": "Co-founder",
        "background": "Previously at Mendable"
      },
      {
        "name": "Nicolas Camara",
        "role": "Co-founder",
        "background": "Previously at Mendable"
      },
      {
        "name": "Caleb Peffer",
        "role": "Co-founder",
        "background": "Previously at Mendable"
      }
    ]
  },
  "expiresAt": "2024-12-15T00:00:00.000Z",
  "creditsUsed": 15
}
```

## Providing URLs (Optional)

You can optionally provide URLs to focus the agent on specific pages:

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import FirecrawlApp

  app = FirecrawlApp(api_key="fc-YOUR_API_KEY")

  result = app.agent(
      urls=["https://docs.firecrawl.dev", "https://firecrawl.dev/pricing"],
      prompt="Compare the features and pricing information from these pages"
  )

  print(result.data)
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR_API_KEY" });

  const result = await firecrawl.agent({
    urls: ["https://docs.firecrawl.dev", "https://firecrawl.dev/pricing"],
    prompt: "Compare the features and pricing information from these pages"
  });

  console.log(result.data);
  ```

  ```bash cURL theme={null}
  curl -X POST "https://api.firecrawl.dev/v2/agent" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "urls": [
        "https://docs.firecrawl.dev",
        "https://firecrawl.dev/pricing"
      ],
      "prompt": "Compare the features and pricing information from these pages"
    }'
  ```
</CodeGroup>

## Job Status and Completion

Agent jobs run asynchronously. When you submit a job, you'll receive a Job ID that you can use to check status:

* **Default method**: `agent()` waits and returns final results
* **Start then poll**: Use `start_agent` (Python) or `startAgent` (Node) to get a Job ID immediately, then poll with `get_agent_status` / `getAgentStatus`

<Note>Job results are available for 24 hours after completion.</Note>

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import FirecrawlApp

  app = FirecrawlApp(api_key="fc-YOUR_API_KEY")

  # Start an agent job
  agent_job = app.start_agent(
      prompt="Find the founders of Firecrawl"
  )

  # Check the status
  status = app.get_agent_status(agent_job.id)

  print(status)
  # Example output:
  # status='completed'
  # success=True
  # data={ ... }
  # expires_at=datetime.datetime(...)
  # credits_used=15
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR_API_KEY" });

  // Start an agent job
  const started = await firecrawl.startAgent({
    prompt: "Find the founders of Firecrawl"
  });

  // Check the status
  if (started.id) {
    const status = await firecrawl.getAgentStatus(started.id);
    console.log(status.status, status.data);
  }
  ```

  ```bash cURL theme={null}
  curl -X GET "https://api.firecrawl.dev/v2/agent/<jobId>" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY"
  ```
</CodeGroup>

### Possible States

| Status       | Description                                |
| ------------ | ------------------------------------------ |
| `processing` | The agent is still working on your request |
| `completed`  | Extraction finished successfully           |
| `failed`     | An error occurred during extraction        |

#### Pending Example

```json JSON theme={null}
{
  "success": true,
  "status": "processing",
  "expiresAt": "2024-12-15T00:00:00.000Z"
}
```

#### Completed Example

```json JSON theme={null}
{
  "success": true,
  "status": "completed",
  "data": {
    "founders": [
      {
        "name": "Eric Ciarla",
        "role": "Co-founder"
      },
      {
        "name": "Nicolas Camara",
        "role": "Co-founder"
      },
      {
        "name": "Caleb Peffer",
        "role": "Co-founder"
      }
    ]
  },
  "expiresAt": "2024-12-15T00:00:00.000Z",
  "creditsUsed": 15
}
```

## Parameters

| Parameter | Type   | Required | Description                                                                          |
| --------- | ------ | -------- | ------------------------------------------------------------------------------------ |
| `prompt`  | string | **Yes**  | Natural language description of the data you want to extract (max 10,000 characters) |
| `urls`    | array  | No       | Optional list of URLs to focus the extraction                                        |
| `schema`  | object | No       | Optional JSON schema for structured output                                           |

## Agent vs Extract: What's Improved

| Feature           | Agent (New) | Extract  |
| ----------------- | ----------- | -------- |
| URLs Required     | No          | Yes      |
| Speed             | Faster      | Standard |
| Cost              | Lower       | Standard |
| Reliability       | Higher      | Standard |
| Query Flexibility | High        | Moderate |

## Example Use Cases

* **Research**: "Find the top 5 AI startups and their funding amounts"
* **Competitive Analysis**: "Compare pricing plans between Slack and Microsoft Teams"
* **Data Gathering**: "Extract contact information from company websites"
* **Content Summarization**: "Summarize the latest blog posts about web scraping"

## API Reference

Check out the [Agent API Reference](/api-reference/endpoint/agent) for more details.

Have feedback or need help? Email [help@firecrawl.com](mailto:help@firecrawl.com).

## Pricing

Firecrawl Agent uses **dynamic billing** that scales with the complexity of your data extraction request. You pay based on the actual work Agent performs, ensuring fair pricing whether you're extracting simple data points or complex structured information from multiple sources.

### How Agent pricing works

Agent pricing is **dynamic and credit-based** during Research Preview:

* **Simple extractions** (like contact info from a single page) typically use fewer credits and cost less
* **Complex research tasks** (like competitive analysis across multiple domains) use more credits but reflect the total effort involved
* **Transparent usage** shows you exactly how many credits each request consumed
* **Credit conversion** automatically converts agent credit usage to credits for easy billing

<Info>
  Credit usage varies based on the complexity of your prompt, the amount of data processed, and the structure of the output requested.
</Info>

### Getting started

**All users** receive **5 free daily runs** to explore Agent's capabilities without any cost.

Additional usage is billed based on credit consumption and converted to credits.

### Managing costs

Agent can be expensive, but there are some ways to decrease the cost:

* **Start with free runs**: Use your 5 daily free requests to understand pricing
* **Set a `maxCredits` parameter**: Limit your spending by setting a maximum number of credits you're willing to spend
* **Optimize prompts**: More specific prompts often use fewer credits
* **Monitor usage**: Track your consumption through the dashboard
* **Set expectations**: Complex multi-domain research will use more credits than simple single-page extractions

Try Agent now at [firecrawl.dev/app/agent](https://www.firecrawl.dev/app/agent) to see how credit usage scales with your specific use cases.

<Note>
  Pricing is subject to change as we move from Research Preview to general availability. Current users will receive advance notice of any pricing updates.
</Note>


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt

# Scrape

> Turn any url into clean data

Firecrawl converts web pages into markdown, ideal for LLM applications.

* It manages complexities: proxies, caching, rate limits, js-blocked content
* Handles dynamic content: dynamic websites, js-rendered sites, PDFs, images
* Outputs clean markdown, structured data, screenshots or html.

For details, see the [Scrape Endpoint API Reference](https://docs.firecrawl.dev/api-reference/endpoint/scrape).

## Scraping a URL with Firecrawl

### /scrape endpoint

Used to scrape a URL and get its content.

### Installation

<CodeGroup>
  ```python Python theme={null}
  # pip install firecrawl-py

  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")
  ```

  ```js Node theme={null}
  # npm install @mendable/firecrawl-js

  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });
  ```
</CodeGroup>

### Usage

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  # Scrape a website:
  doc = firecrawl.scrape("https://firecrawl.dev", formats=["markdown", "html"])
  print(doc)
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  // Scrape a website:
  const doc = await firecrawl.scrape('https://firecrawl.dev', { formats: ['markdown', 'html'] });
  console.log(doc);
  ```

  ```bash cURL theme={null}
  curl -s -X POST "https://api.firecrawl.dev/v2/scrape" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://firecrawl.dev",
      "formats": ["markdown", "html"]
    }'
  ```
</CodeGroup>

For more details about the parameters, refer to the [API Reference](https://docs.firecrawl.dev/api-reference/endpoint/scrape).

### Response

SDKs will return the data object directly. cURL will return the payload exactly as shown below.

```json  theme={null}
{
  "success": true,
  "data" : {
    "markdown": "Launch Week I is here! [See our Day 2 Release 🚀](https://www.firecrawl.dev/blog/launch-week-i-day-2-doubled-rate-limits)[💥 Get 2 months free...",
    "html": "<!DOCTYPE html><html lang=\"en\" class=\"light\" style=\"color-scheme: light;\"><body class=\"__variable_36bd41 __variable_d7dc5d font-inter ...",
    "metadata": {
      "title": "Home - Firecrawl",
      "description": "Firecrawl crawls and converts any website into clean markdown.",
      "language": "en",
      "keywords": "Firecrawl,Markdown,Data,Mendable,Langchain",
      "robots": "follow, index",
      "ogTitle": "Firecrawl",
      "ogDescription": "Turn any website into LLM-ready data.",
      "ogUrl": "https://www.firecrawl.dev/",
      "ogImage": "https://www.firecrawl.dev/og.png?123",
      "ogLocaleAlternate": [],
      "ogSiteName": "Firecrawl",
      "sourceURL": "https://firecrawl.dev",
      "statusCode": 200
    }
  }
}
```

## Scrape Formats

You can now choose what formats you want your output in. You can specify multiple output formats. Supported formats are:

* Markdown (`markdown`)
* Summary (`summary`)
* HTML (`html`)
* Raw HTML (`rawHtml`) (with no modifications)
* Screenshot (`screenshot`, with options like `fullPage`, `quality`, `viewport`)
* Links (`links`)
* JSON (`json`) - structured output
* Images (`images`) - extract all image URLs from the page
* Branding (`branding`) - extract brand identity and design system

Output keys will match the format you choose.

## Extract structured data

### /scrape (with json) endpoint

Used to extract structured data from scraped pages.

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl
  from pydantic import BaseModel

  app = Firecrawl(api_key="fc-YOUR-API-KEY")

  class CompanyInfo(BaseModel):
      company_mission: str
      supports_sso: bool
      is_open_source: bool
      is_in_yc: bool

  result = app.scrape(
      'https://firecrawl.dev',
      formats=[{
        "type": "json",
        "schema": CompanyInfo.model_json_schema()
      }],
      only_main_content=False,
      timeout=120000
  )

  print(result)
  ```

  ```js Node theme={null}
  import FirecrawlApp from "@mendable/firecrawl-js";
  import { z } from "zod";

  const app = new FirecrawlApp({
    apiKey: "fc-YOUR_API_KEY"
  });

  // Define schema to extract contents into
  const schema = z.object({
    company_mission: z.string(),
    supports_sso: z.boolean(),
    is_open_source: z.boolean(),
    is_in_yc: z.boolean()
  });

  const result = await app.scrape("https://firecrawl.dev", {
    formats: [{
      type: "json",
      schema: schema
    }],
  });

  console.log(result);
  ```

  ```bash cURL theme={null}
  curl -X POST https://api.firecrawl.dev/v2/scrape \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_API_KEY' \
      -d '{
        "url": "https://firecrawl.dev",
        "formats": [ {
          "type": "json",
          "schema": {
            "type": "object",
            "properties": {
              "company_mission": {
                        "type": "string"
              },
              "supports_sso": {
                        "type": "boolean"
              },
              "is_open_source": {
                        "type": "boolean"
              },
              "is_in_yc": {
                        "type": "boolean"
              }
            },
            "required": [
              "company_mission",
              "supports_sso",
              "is_open_source",
              "is_in_yc"
            ]
          }
        } ]
      }'
  ```
</CodeGroup>

Output:

```json JSON theme={null}
{
    "success": true,
    "data": {
      "json": {
        "company_mission": "AI-powered web scraping and data extraction",
        "supports_sso": true,
        "is_open_source": true,
        "is_in_yc": true
      },
      "metadata": {
        "title": "Firecrawl",
        "description": "AI-powered web scraping and data extraction",
        "robots": "follow, index",
        "ogTitle": "Firecrawl",
        "ogDescription": "AI-powered web scraping and data extraction",
        "ogUrl": "https://firecrawl.dev/",
        "ogImage": "https://firecrawl.dev/og.png",
        "ogLocaleAlternate": [],
        "ogSiteName": "Firecrawl",
        "sourceURL": "https://firecrawl.dev/"
      },
    }
}
```

### Extracting without schema

You can now extract without a schema by just passing a `prompt` to the endpoint. The llm chooses the structure of the data.

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  app = Firecrawl(api_key="fc-YOUR-API-KEY")

  result = app.scrape(
      'https://firecrawl.dev',
      formats=[{
        "type": "json",
        "prompt": "Extract the company mission from the page."
      }],
      only_main_content=False,
      timeout=120000
  )

  print(result)
  ```

  ```js Node theme={null}
  import FirecrawlApp from "@mendable/firecrawl-js";

  const app = new FirecrawlApp({
    apiKey: "fc-YOUR_API_KEY"
  });

  const result = await app.scrape("https://firecrawl.dev", {
    formats: [{
      type: "json",
      prompt: "Extract the company mission from the page."
    }]
  });

  console.log(result);
  ```

  ```bash cURL theme={null}
  curl -X POST https://api.firecrawl.dev/v2/scrape \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_API_KEY' \
      -d '{
        "url": "https://firecrawl.dev",
        "formats": [{
          "type": "json",
          "prompt": "Extract the company mission from the page."
        }]
      }'
  ```
</CodeGroup>

Output:

```json JSON theme={null}
{
    "success": true,
    "data": {
      "json": {
        "company_mission": "AI-powered web scraping and data extraction",
      },
      "metadata": {
        "title": "Firecrawl",
        "description": "AI-powered web scraping and data extraction",
        "robots": "follow, index",
        "ogTitle": "Firecrawl",
        "ogDescription": "AI-powered web scraping and data extraction",
        "ogUrl": "https://firecrawl.dev/",
        "ogImage": "https://firecrawl.dev/og.png",
        "ogLocaleAlternate": [],
        "ogSiteName": "Firecrawl",
        "sourceURL": "https://firecrawl.dev/"
      },
    }
}
```

### JSON format options

When using the `json` format, pass an object inside `formats` with the following parameters:

* `schema`: JSON Schema for the structured output.
* `prompt`: Optional prompt to help guide extraction when a schema is present or when you prefer light guidance.

## Extract brand identity

### /scrape (with branding) endpoint

The branding format extracts comprehensive brand identity information from a webpage, including colors, fonts, typography, spacing, UI components, and more. This is useful for design system analysis, brand monitoring, or building tools that need to understand a website's visual identity.

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key='fc-YOUR_API_KEY')

  result = firecrawl.scrape(
      url='https://firecrawl.dev',
      formats=['branding']
  )

  print(result['branding'])
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const result = await firecrawl.scrape('https://firecrawl.dev', {
      formats: ['branding']
  });

  console.log(result.branding);
  ```

  ```bash cURL theme={null}
  curl -s -X POST "https://api.firecrawl.dev/v2/scrape" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://firecrawl.dev",
      "formats": ["branding"]
    }'
  ```
</CodeGroup>

### Response

The branding format returns a comprehensive `BrandingProfile` object with the following structure:

```json Output theme={null}
{
  "success": true,
  "data": {
    "branding": {
      "colorScheme": "dark",
      "logo": "https://firecrawl.dev/logo.svg",
      "colors": {
        "primary": "#FF6B35",
        "secondary": "#004E89",
        "accent": "#F77F00",
        "background": "#1A1A1A",
        "textPrimary": "#FFFFFF",
        "textSecondary": "#B0B0B0"
      },
      "fonts": [
        {
          "family": "Inter"
        },
        {
          "family": "Roboto Mono"
        }
      ],
      "typography": {
        "fontFamilies": {
          "primary": "Inter",
          "heading": "Inter",
          "code": "Roboto Mono"
        },
        "fontSizes": {
          "h1": "48px",
          "h2": "36px",
          "h3": "24px",
          "body": "16px"
        },
        "fontWeights": {
          "regular": 400,
          "medium": 500,
          "bold": 700
        }
      },
      "spacing": {
        "baseUnit": 8,
        "borderRadius": "8px"
      },
      "components": {
        "buttonPrimary": {
          "background": "#FF6B35",
          "textColor": "#FFFFFF",
          "borderRadius": "8px"
        },
        "buttonSecondary": {
          "background": "transparent",
          "textColor": "#FF6B35",
          "borderColor": "#FF6B35",
          "borderRadius": "8px"
        }
      },
      "images": {
        "logo": "https://firecrawl.dev/logo.svg",
        "favicon": "https://firecrawl.dev/favicon.ico",
        "ogImage": "https://firecrawl.dev/og-image.png"
      }
    }
  }
}
```

### Branding Profile Structure

The `branding` object contains the following properties:

* `colorScheme`: The detected color scheme (`"light"` or `"dark"`)
* `logo`: URL of the primary logo
* `colors`: Object containing brand colors:
  * `primary`, `secondary`, `accent`: Main brand colors
  * `background`, `textPrimary`, `textSecondary`: UI colors
  * `link`, `success`, `warning`, `error`: Semantic colors
* `fonts`: Array of font families used on the page
* `typography`: Detailed typography information:
  * `fontFamilies`: Primary, heading, and code font families
  * `fontSizes`: Size definitions for headings and body text
  * `fontWeights`: Weight definitions (light, regular, medium, bold)
  * `lineHeights`: Line height values for different text types
* `spacing`: Spacing and layout information:
  * `baseUnit`: Base spacing unit in pixels
  * `borderRadius`: Default border radius
  * `padding`, `margins`: Spacing values
* `components`: UI component styles:
  * `buttonPrimary`, `buttonSecondary`: Button styles
  * `input`: Input field styles
* `icons`: Icon style information
* `images`: Brand images (logo, favicon, og:image)
* `animations`: Animation and transition settings
* `layout`: Layout configuration (grid, header/footer heights)
* `personality`: Brand personality traits (tone, energy, target audience)

### Combining with other formats

You can combine the branding format with other formats to get comprehensive page data:

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key='fc-YOUR_API_KEY')

  result = firecrawl.scrape(
      url='https://firecrawl.dev',
      formats=['markdown', 'branding', 'screenshot']
  )

  print(result['markdown'])
  print(result['branding'])
  print(result['screenshot'])
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const result = await firecrawl.scrape('https://firecrawl.dev', {
      formats: ['markdown', 'branding', 'screenshot']
  });

  console.log(result.markdown);
  console.log(result.branding);
  console.log(result.screenshot);
  ```

  ```bash cURL theme={null}
  curl -s -X POST "https://api.firecrawl.dev/v2/scrape" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://firecrawl.dev",
      "formats": ["markdown", "branding", "screenshot"]
    }'
  ```
</CodeGroup>

## Interacting with the page with Actions

Firecrawl allows you to perform various actions on a web page before scraping its content. This is particularly useful for interacting with dynamic content, navigating through pages, or accessing content that requires user interaction.

Here is an example of how to use actions to navigate to google.com, search for Firecrawl, click on the first result, and take a screenshot.

It is important to almost always use the `wait` action before/after executing other actions to give enough time for the page to load.

### Example

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  doc = firecrawl.scrape(
      url="https://example.com/login",
      formats=["markdown"],
      actions=[
          {"type": "write", "text": "john@example.com"},
          {"type": "press", "key": "Tab"},
          {"type": "write", "text": "secret"},
          {"type": "click", "selector": 'button[type="submit"]'},
          {"type": "wait", "milliseconds": 1500},
          {"type": "screenshot", "fullPage": True},
      ],
  )

  print(doc.markdown, doc.screenshot)
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const doc = await firecrawl.scrape('https://example.com/login', {
    formats: ['markdown'],
    actions: [
      { type: 'write', text: 'john@example.com' },
      { type: 'press', key: 'Tab' },
      { type: 'write', text: 'secret' },
      { type: 'click', selector: 'button[type="submit"]' },
      { type: 'wait', milliseconds: 1500 },
      { type: 'screenshot', fullPage: true },
    ],
  });

  console.log(doc.markdown, doc.screenshot);
  ```

  ```bash cURL theme={null}
  curl -X POST https://api.firecrawl.dev/v2/scrape \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_API_KEY' \
      -d '{
        "url": "https://example.com/login",
        "formats": ["markdown"],
        "actions": [
          { "type": "write", "text": "john@example.com" },
          { "type": "press", "key": "Tab" },
          { "type": "write", "text": "secret" },
          { "type": "click", "selector": "button[type=\"submit\"]" },
          { "type": "wait", "milliseconds": 1500 },
          { "type": "screenshot", "fullPage": true },
        ],
    }'
  ```
</CodeGroup>

### Output

<CodeGroup>
  ```json JSON theme={null}
  {
    "success": true,
    "data": {
      "markdown": "Our first Launch Week is over! [See the recap 🚀](blog/firecrawl-launch-week-1-recap)...",
      "actions": {
        "screenshots": [
          "https://alttmdsdujxrfnakrkyi.supabase.co/storage/v1/object/public/media/screenshot-75ef2d87-31e0-4349-a478-fb432a29e241.png"
        ],
        "scrapes": [
          {
            "url": "https://www.firecrawl.dev/",
            "html": "<html><body><h1>Firecrawl</h1></body></html>"
          }
        ]
      },
      "metadata": {
        "title": "Home - Firecrawl",
        "description": "Firecrawl crawls and converts any website into clean markdown.",
        "language": "en",
        "keywords": "Firecrawl,Markdown,Data,Mendable,Langchain",
        "robots": "follow, index",
        "ogTitle": "Firecrawl",
        "ogDescription": "Turn any website into LLM-ready data.",
        "ogUrl": "https://www.firecrawl.dev/",
        "ogImage": "https://www.firecrawl.dev/og.png?123",
        "ogLocaleAlternate": [],
        "ogSiteName": "Firecrawl",
        "sourceURL": "http://google.com",
        "statusCode": 200
      }
    }
  }
  ```
</CodeGroup>

For more details about the actions parameters, refer to the [API Reference](https://docs.firecrawl.dev/api-reference/endpoint/scrape).

## Location and Language

Specify country and preferred languages to get relevant content based on your target location and language preferences.

### How it works

When you specify the location settings, Firecrawl will use an appropriate proxy if available and emulate the corresponding language and timezone settings. By default, the location is set to 'US' if not specified.

### Usage

To use the location and language settings, include the `location` object in your request body with the following properties:

* `country`: ISO 3166-1 alpha-2 country code (e.g., 'US', 'AU', 'DE', 'JP'). Defaults to 'US'.
* `languages`: An array of preferred languages and locales for the request in order of priority. Defaults to the language of the specified location.

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  doc = firecrawl.scrape('https://example.com',
      formats=['markdown'],
      location={
          'country': 'US',
          'languages': ['en']
      }
  )

  print(doc)
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const doc = await firecrawl.scrape('https://example.com', {
    formats: ['markdown'],
    location: { country: 'US', languages: ['en'] },
  });

  console.log(doc.metadata);
  ```

  ```bash cURL theme={null}
  curl -X POST "https://api.firecrawl.dev/v2/scrape" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://example.com",
      "formats": ["markdown"],
      "location": { "country": "US", "languages": ["en"] }
    }'
  ```
</CodeGroup>

For more details about supported locations, refer to the [Proxies documentation](/features/proxies).

## Caching and maxAge

To make requests faster, Firecrawl serves results from cache by default when a recent copy is available.

* **Default freshness window**: `maxAge = 172800000` ms (2 days). If a cached page is newer than this, it’s returned instantly; otherwise, the page is scraped and then cached.
* **Performance**: This can speed up scrapes by up to 5x when data doesn’t need to be ultra-fresh.
* **Always fetch fresh**: Set `maxAge` to `0`.
* **Avoid storing**: Set `storeInCache` to `false` if you don’t want Firecrawl to cache/store results for this request.

Example (force fresh content):

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl
  firecrawl = Firecrawl(api_key='fc-YOUR_API_KEY')

  doc = firecrawl.scrape(url='https://example.com', maxAge=0, formats=['markdown'])
  print(doc)
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const doc = await firecrawl.scrape('https://example.com', { maxAge: 0, formats: ['markdown'] });
  console.log(doc);
  ```

  ```bash cURL theme={null}
  curl -s -X POST "https://api.firecrawl.dev/v2/scrape" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://example.com",
      "maxAge": 0,
      "formats": ["markdown"]
    }'
  ```
</CodeGroup>

Example (use a 10-minute cache window):

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl
  firecrawl = Firecrawl(api_key='fc-YOUR_API_KEY')

  doc = firecrawl.scrape(url='https://example.com', maxAge=600000, formats=['markdown', 'html'])
  print(doc)
  ```

  ```js Node theme={null}

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const doc = await firecrawl.scrape('https://example.com', { maxAge: 600000, formats: ['markdown', 'html'] });
  console.log(doc);
  ```

  ```bash cURL theme={null}
  curl -s -X POST "https://api.firecrawl.dev/v2/scrape" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://example.com",
      "maxAge": 600000,
      "formats": ["markdown", "html"]
    }'
  ```
</CodeGroup>

## Batch scraping multiple URLs

You can now batch scrape multiple URLs at the same time. It takes the starting URLs and optional parameters as arguments. The params argument allows you to specify additional options for the batch scrape job, such as the output formats.

### How it works

It is very similar to how the `/crawl` endpoint works. It submits a batch scrape job and returns a job ID to check the status of the batch scrape.

The sdk provides 2 methods, synchronous and asynchronous. The synchronous method will return the results of the batch scrape job, while the asynchronous method will return a job ID that you can use to check the status of the batch scrape.

### Usage

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  job = firecrawl.batch_scrape([
      "https://firecrawl.dev",
      "https://docs.firecrawl.dev",
  ], formats=["markdown"], poll_interval=2, wait_timeout=120)

  print(job)
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const job = await firecrawl.batchScrape([
    'https://firecrawl.dev',
    'https://docs.firecrawl.dev',
  ], { options: { formats: ['markdown'] }, pollInterval: 2, timeout: 120 });

  console.log(job);
  ```

  ```bash cURL theme={null}
  curl -s -X POST "https://api.firecrawl.dev/v2/batch/scrape" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "urls": ["https://firecrawl.dev", "https://docs.firecrawl.dev"],
      "formats": ["markdown"]
    }'
  ```
</CodeGroup>

### Response

If you’re using the sync methods from the SDKs, it will return the results of the batch scrape job. Otherwise, it will return a job ID that you can use to check the status of the batch scrape.

#### Synchronous

```json Completed theme={null}
{
  "status": "completed",
  "total": 36,
  "completed": 36,
  "creditsUsed": 36,
  "expiresAt": "2024-00-00T00:00:00.000Z",
  "next": "https://api.firecrawl.dev/v2/batch/scrape/123-456-789?skip=26",
  "data": [
    {
      "markdown": "[Firecrawl Docs home page![light logo](https://mintlify.s3-us-west-1.amazonaws.com/firecrawl/logo/light.svg)!...",
      "html": "<!DOCTYPE html><html lang=\"en\" class=\"js-focus-visible lg:[--scroll-mt:9.5rem]\" data-js-focus-visible=\"\">...",
      "metadata": {
        "title": "Build a 'Chat with website' using Groq Llama 3 | Firecrawl",
        "language": "en",
        "sourceURL": "https://docs.firecrawl.dev/learn/rag-llama3",
        "description": "Learn how to use Firecrawl, Groq Llama 3, and Langchain to build a 'Chat with your website' bot.",
        "ogLocaleAlternate": [],
        "statusCode": 200
      }
    },
    ...
  ]
}
```

#### Asynchronous

You can then use the job ID to check the status of the batch scrape by calling the `/batch/scrape/{id}` endpoint. This endpoint is meant to be used while the job is still running or right after it has completed **as batch scrape jobs expire after 24 hours**.

```json  theme={null}
{
  "success": true,
  "id": "123-456-789",
  "url": "https://api.firecrawl.dev/v2/batch/scrape/123-456-789"
}
```

## Stealth Mode

For websites with advanced anti-bot protection, Firecrawl offers a stealth proxy mode that provides better success rates at scraping challenging sites.

Learn more about [Stealth Mode](/features/stealth-mode).


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt

# Faster Scraping

> Speed up your scrapes by 500% with the maxAge parameter

## How It Works

Firecrawl caches previously scraped pages and, by default, returns a recent copy when available.

* **Default freshness**: `maxAge = 172800000` ms (2 days). If the cached copy is newer than this, it’s returned instantly; otherwise, Firecrawl scrapes fresh and updates the cache.
* **Force fresh**: Set `maxAge: 0` to always scrape.
* **Skip caching**: Set `storeInCache: false` if you don’t want to store results for a request.

Get your results **up to 500% faster** when you don’t need the absolute freshest data. Control freshness via `maxAge`:

1. **Return instantly** if we have a recent version of the page
2. **Scrape fresh** only if our version is older than your specified age
3. **Save you time** - results come back in milliseconds instead of seconds

## When to Use This

**Great for:**

* Documentation, articles, product pages
* Bulk processing jobs
* Development and testing
* Building knowledge bases

**Skip for:**

* Real-time data (stock prices, live scores, breaking news)
* Frequently updated content
* Time-sensitive applications

## Usage

Add `maxAge` to your scrape request. Values are in milliseconds (e.g., `3600000` = 1 hour).

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR_API_KEY")

  # Use cached data if it's less than 1 hour old (3600000 ms)
  # This can be 500% faster than a fresh scrape!
  scrape_result = firecrawl.scrape(
      'https://firecrawl.dev', 
      formats=['markdown'],
      maxAge=3600000  # 1 hour in milliseconds
  )

  print(scrape_result['markdown'])
  ```

  ```javascript JavaScript theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR_API_KEY" });

  // Use cached data if it's less than 1 hour old (3600000 ms)
  // This can be 500% faster than a fresh scrape!
  const scrapeResult = await firecrawl.scrape('https://firecrawl.dev', {
    formats: ['markdown'],
    maxAge: 3600000 // 1 hour in milliseconds
  });

  console.log(scrapeResult.markdown);
  ```
</CodeGroup>

## Common maxAge values

Here are some helpful reference values:

* **5 minutes**: `300000` - For semi-dynamic content
* **1 hour**: `3600000` - For content that updates hourly
* **1 day**: `86400000` - For daily-updated content
* **1 week**: `604800000` - For relatively static content

## Performance impact

With `maxAge` enabled:

* **500% faster response times** for recent content
* **Instant results** instead of waiting for fresh scrapes

## Important notes

* **Default**: `maxAge` is `172800000` (2 days)
* **Fresh when needed**: If our data is older than `maxAge`, we scrape fresh automatically
* **No stale data**: You'll never get data older than your specified `maxAge`

## Faster crawling

The same speed benefits apply when crawling multiple pages. Use `maxAge` within `scrapeOptions` to get cached results for pages we’ve seen recently.

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR_API_KEY")

  # Crawl with cached scraping - 500% faster for pages we've seen recently
  crawl_result = firecrawl.crawl(
      'https://firecrawl.dev', 
      limit=100,
      scrape_options={
          formats=['markdown'],
          maxAge=3600000  # Use cached data if less than 1 hour old
      }
  )

  for page in crawl_result['data']:
      print(f"URL: {page['metadata']['sourceURL']}")
      print(f"Content: {page['markdown'][:200]}...")
  ```

  ```javascript JavaScript theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR_API_KEY" });

  // Crawl with cached scraping - 500% faster for pages we've seen recently
  const crawlResult = await firecrawl.crawl('https://firecrawl.dev', {
    limit: 100,
    scrapeOptions: {
      formats: ['markdown'],
      maxAge: 3600000 // Use cached data if less than 1 hour old
    }
  });

  crawlResult.data.forEach(page => {
    console.log(`URL: ${page.metadata.sourceURL}`);
    console.log(`Content: ${page.markdown.substring(0, 200)}...`);
  });
  ```

  ```bash cURL theme={null}
  curl -X POST https://api.firecrawl.dev/v2/crawl \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer fc-YOUR_API_KEY' \
    -d '{
      "url": "https://firecrawl.dev",
      "limit": 100,
      "scrapeOptions": {
        "formats": ["markdown"],
        "maxAge": 3600000
      }
    }'
  ```
</CodeGroup>

When crawling with `maxAge`, each page in your crawl will benefit from the 500% speed improvement if we have recent cached data for that page.

Start using `maxAge` today for dramatically faster scrapes and crawls!


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt

# Batch Scrape

> Batch scrape multiple URLs

## Batch scraping multiple URLs

You can now batch scrape multiple URLs at the same time. It takes the starting URLs and optional parameters as arguments. The params argument allows you to specify additional options for the batch scrape job, such as the output formats.

### How it works

It is very similar to how the `/crawl` endpoint works. You can either start the batch and wait for completion, or start it and handle completion yourself.

* `batchScrape` (JS) / `batch_scrape` (Python): starts a batch job and waits for it to complete, returning the results.
* `startBatchScrape` (JS) / `start_batch_scrape` (Python): starts a batch job and returns the job ID so you can poll or use webhooks.

### Usage

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  start = firecrawl.start_batch_scrape([
      "https://firecrawl.dev",
      "https://docs.firecrawl.dev",
  ], formats=["markdown"])  # returns id

  job = firecrawl.batch_scrape([
      "https://firecrawl.dev",
      "https://docs.firecrawl.dev",
  ], formats=["markdown"], poll_interval=2, wait_timeout=120)

  print(job.status, job.completed, job.total)
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  // Start a batch scrape job
  const { id } = await firecrawl.startBatchScrape([
    'https://firecrawl.dev',
    'https://docs.firecrawl.dev'
  ], {
    options: { formats: ['markdown'] },
  });

  // Wait for completion
  const job = await firecrawl.batchScrape([
    'https://firecrawl.dev',
    'https://docs.firecrawl.dev'
  ], { options: { formats: ['markdown'] }, pollInterval: 2, timeout: 120 });

  console.log(job.status, job.completed, job.total);
  ```

  ```bash cURL theme={null}
  curl -s -X POST "https://api.firecrawl.dev/v2/batch/scrape" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "urls": ["https://firecrawl.dev", "https://docs.firecrawl.dev"],
      "formats": ["markdown"]
    }'
  ```
</CodeGroup>

### Response

Calling `batchScrape`/`batch_scrape` returns the full results when the batch completes.

```json Completed theme={null}
{
  "status": "completed",
  "total": 36,
  "completed": 36,
  "creditsUsed": 36,
  "expiresAt": "2024-00-00T00:00:00.000Z",
  "next": "https://api.firecrawl.dev/v2/batch/scrape/123-456-789?skip=26",
  "data": [
    {
      "markdown": "[Firecrawl Docs home page![light logo](https://mintlify.s3-us-west-1.amazonaws.com/firecrawl/logo/light.svg)!...",
      "html": "<!DOCTYPE html><html lang=\"en\" class=\"js-focus-visible lg:[--scroll-mt:9.5rem]\" data-js-focus-visible=\"\">...",
      "metadata": {
        "title": "Build a 'Chat with website' using Groq Llama 3 | Firecrawl",
        "language": "en",
        "sourceURL": "https://docs.firecrawl.dev/learn/rag-llama3",
        "description": "Learn how to use Firecrawl, Groq Llama 3, and Langchain to build a 'Chat with your website' bot.",
        "ogLocaleAlternate": [],
        "statusCode": 200
      }
    },
    ...
  ]
}
```

Calling `startBatchScrape`/`start_batch_scrape` returns
a job ID you can track via `getBatchScrapeStatus`/`get_batch_scrape_status`, using
the API endpoint `/batch/scrape/{id}`, or webhooks. This endpoint is intended for
in-progress checks or immediately after completion, **as batch jobs expire after
24 hours**.

```json  theme={null}
{
  "success": true,
  "id": "123-456-789",
  "url": "https://api.firecrawl.dev/v2/batch/scrape/123-456-789"
}
```

## Batch scrape with structured extraction

You can also use the batch scrape endpoint to extract structured data from the pages. This is useful if you want to get the same structured data from a list of URLs.

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR_API_KEY")

  # Scrape multiple websites:
  batch_scrape_result = firecrawl.batch_scrape(
      ['https://docs.firecrawl.dev', 'https://docs.firecrawl.dev/sdks/overview'], 
      formats=[{
          'type': 'json',
          'prompt': 'Extract the title and description from the page.',
          'schema': {
              'type': 'object',
              'properties': {
                  'title': {'type': 'string'},
                  'description': {'type': 'string'}
              },
              'required': ['title', 'description']
          }
      }]
  )
  print(batch_scrape_result)

  # Or, you can use the start method:
  batch_scrape_job = firecrawl.start_batch_scrape(
      ['https://docs.firecrawl.dev', 'https://docs.firecrawl.dev/sdks/overview'], 
      formats=[{
          'type': 'json',
          'prompt': 'Extract the title and description from the page.',
          'schema': {
              'type': 'object',
              'properties': {
                  'title': {'type': 'string'},
                  'description': {'type': 'string'}
              },
              'required': ['title', 'description']
          }
      }]
  )
  print(batch_scrape_job)

  # You can then use the job ID to check the status of the batch scrape:
  batch_scrape_status = firecrawl.get_batch_scrape_status(batch_scrape_job.id)
  print(batch_scrape_status)
  ```

  ```js Node theme={null}
  import Firecrawl, { ScrapeResponse } from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({apiKey: "fc-YOUR_API_KEY"});

  // Define schema to extract contents into
  const schema = {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" }
    },
    required: ["title", "description"]
  };

  // Scrape multiple websites (synchronous):
  const batchScrapeResult = await firecrawl.batchScrape(['https://docs.firecrawl.dev', 'https://docs.firecrawl.dev/sdks/overview'], { 
    formats: [
      {
        type: "json",
        prompt: "Extract the title and description from the page.",
        schema: schema
      }
    ]
  });

  // Output all the results of the batch scrape:
  console.log(batchScrapeResult)

  // Or, you can use the start method:
  const batchScrapeJob = await firecrawl.startBatchScrape(['https://docs.firecrawl.dev', 'https://docs.firecrawl.dev/sdks/overview'], { 
    formats: [
      {
        type: "json",
        prompt: "Extract the title and description from the page.",
        schema: schema
      }
    ]
  });
  console.log(batchScrapeJob)

  // You can then use the job ID to check the status of the batch scrape:
  const batchScrapeStatus = await firecrawl.getBatchScrapeStatus(batchScrapeJob.id);
  console.log(batchScrapeStatus)
  ```

  ```bash cURL theme={null}
  curl -X POST https://api.firecrawl.dev/v2/batch/scrape \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_API_KEY' \
      -d '{
        "urls": ["https://docs.firecrawl.dev", "https://docs.firecrawl.dev/sdks/overview"],
        "formats" : [{
          "type": "json",
          "prompt": "Extract the title and description from the page.",
          "schema": {
            "type": "object",
            "properties": {
              "title": {
                "type": "string"
              },
              "description": {
                "type": "string"
              }
            },
            "required": [
              "title",
              "description"
            ]
          }
        }]
      }'
  ```
</CodeGroup>

### Response

`batchScrape`/`batch_scrape` returns full results:

```json Completed theme={null}
{
  "status": "completed",
  "total": 36,
  "completed": 36,
  "creditsUsed": 36,
  "expiresAt": "2024-00-00T00:00:00.000Z",
  "next": "https://api.firecrawl.dev/v2/batch/scrape/123-456-789?skip=26",
  "data": [
    {
      "json": {
        "title": "Build a 'Chat with website' using Groq Llama 3 | Firecrawl",
        "description": "Learn how to use Firecrawl, Groq Llama 3, and Langchain to build a 'Chat with your website' bot."
      }
    },
    ...
  ]
}
```

`startBatchScrape`/`start_batch_scrape` returns a job ID:

```json  theme={null}
{
  "success": true,
  "id": "123-456-789",
  "url": "https://api.firecrawl.dev/v2/batch/scrape/123-456-789"
}
```

## Batch scrape with webhooks

You can configure webhooks to receive real-time notifications as each URL in your batch is scraped. This allows you to process results immediately instead of waiting for the entire batch to complete.

```bash cURL theme={null}
curl -X POST https://api.firecrawl.dev/v2/batch/scrape \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer YOUR_API_KEY' \
    -d '{
      "urls": [
        "https://example.com/page1",
        "https://example.com/page2",
        "https://example.com/page3"
      ],
      "webhook": {
        "url": "https://your-domain.com/webhook",
        "metadata": {
          "any_key": "any_value"
        },
        "events": ["started", "page", "completed"]
      }
    }' 
```

For comprehensive webhook documentation including event types, payload structure, and implementation examples, see the [Webhooks documentation](/webhooks/overview).

### Quick Reference

**Event Types:**

* `batch_scrape.started` - When the batch scrape begins
* `batch_scrape.page` - For each URL successfully scraped
* `batch_scrape.completed` - When all URLs are processed
* `batch_scrape.failed` - If the batch scrape encounters an error

**Basic Payload:**

```json  theme={null}
{
  "success": true,
  "type": "batch_scrape.page",
  "id": "batch-job-id",
  "data": [...], // Page data for 'page' events
  "metadata": {}, // Your custom metadata
  "error": null
}
```

<Note>
  For detailed webhook configuration, security best practices, and
  troubleshooting, visit the [Webhooks documentation](/webhooks/overview).
</Note>


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt

# JSON mode - Structured result

> Extract structured data from pages via LLMs

<Note>
  **v2 API Change:** JSON schema extraction is fully supported in v2, but the API format has changed. In v2, the schema is embedded directly inside the format object as `formats: [{type: "json", schema: {...}}]`. The v1 `jsonOptions` parameter no longer exists in v2.
</Note>

## Scrape and extract structured data with Firecrawl

Firecrawl uses AI to get structured data from web pages in 3 steps:

1. **Set the Schema (optional):**
   Define a JSON schema (using OpenAI's format) to specify the data you want, or just provide a `prompt` if you don't need a strict schema, along with the webpage URL.

2. **Make the Request:**
   Send your URL and schema to our scrape endpoint using JSON mode. See how here:
   [Scrape Endpoint Documentation](https://docs.firecrawl.dev/api-reference/endpoint/scrape)

3. **Get Your Data:**
   Get back clean, structured data matching your schema that you can use right away.

This makes getting web data in the format you need quick and easy.

## Extract structured data

### JSON mode via /scrape

Used to extract structured data from scraped pages.

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl
  from pydantic import BaseModel

  app = Firecrawl(api_key="fc-YOUR-API-KEY")

  class CompanyInfo(BaseModel):
      company_mission: str
      supports_sso: bool
      is_open_source: bool
      is_in_yc: bool

  result = app.scrape(
      'https://firecrawl.dev',
      formats=[{
        "type": "json",
        "schema": CompanyInfo.model_json_schema()
      }],
      only_main_content=False,
      timeout=120000
  )

  print(result)
  ```

  ```js Node theme={null}
  import FirecrawlApp from "@mendable/firecrawl-js";
  import { z } from "zod";

  const app = new FirecrawlApp({
    apiKey: "fc-YOUR_API_KEY"
  });

  // Define schema to extract contents into
  const schema = z.object({
    company_mission: z.string(),
    supports_sso: z.boolean(),
    is_open_source: z.boolean(),
    is_in_yc: z.boolean()
  });

  const result = await app.scrape("https://firecrawl.dev", {
    formats: [{
      type: "json",
      schema: schema
    }],
  });

  console.log(result);
  ```

  ```bash cURL theme={null}
  curl -X POST https://api.firecrawl.dev/v2/scrape \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_API_KEY' \
      -d '{
        "url": "https://firecrawl.dev",
        "formats": [ {
          "type": "json",
          "schema": {
            "type": "object",
            "properties": {
              "company_mission": {
                        "type": "string"
              },
              "supports_sso": {
                        "type": "boolean"
              },
              "is_open_source": {
                        "type": "boolean"
              },
              "is_in_yc": {
                        "type": "boolean"
              }
            },
            "required": [
              "company_mission",
              "supports_sso",
              "is_open_source",
              "is_in_yc"
            ]
          }
        } ]
      }'
  ```
</CodeGroup>

Output:

```json JSON theme={null}
{
    "success": true,
    "data": {
      "json": {
        "company_mission": "AI-powered web scraping and data extraction",
        "supports_sso": true,
        "is_open_source": true,
        "is_in_yc": true
      },
      "metadata": {
        "title": "Firecrawl",
        "description": "AI-powered web scraping and data extraction",
        "robots": "follow, index",
        "ogTitle": "Firecrawl",
        "ogDescription": "AI-powered web scraping and data extraction",
        "ogUrl": "https://firecrawl.dev/",
        "ogImage": "https://firecrawl.dev/og.png",
        "ogLocaleAlternate": [],
        "ogSiteName": "Firecrawl",
        "sourceURL": "https://firecrawl.dev/"
      },
    }
}
```

### Structured data without schema

You can also extract without a schema by just passing a `prompt` to the endpoint. The llm chooses the structure of the data.

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  app = Firecrawl(api_key="fc-YOUR-API-KEY")

  result = app.scrape(
      'https://firecrawl.dev',
      formats=[{
        "type": "json",
        "prompt": "Extract the company mission from the page."
      }],
      only_main_content=False,
      timeout=120000
  )

  print(result)
  ```

  ```js Node theme={null}
  import FirecrawlApp from "@mendable/firecrawl-js";

  const app = new FirecrawlApp({
    apiKey: "fc-YOUR_API_KEY"
  });

  const result = await app.scrape("https://firecrawl.dev", {
    formats: [{
      type: "json",
      prompt: "Extract the company mission from the page."
    }]
  });

  console.log(result);
  ```

  ```bash cURL theme={null}
  curl -X POST https://api.firecrawl.dev/v2/scrape \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_API_KEY' \
      -d '{
        "url": "https://firecrawl.dev",
        "formats": [{
          "type": "json",
          "prompt": "Extract the company mission from the page."
        }]
      }'
  ```
</CodeGroup>

Output:

```json JSON theme={null}
{
    "success": true,
    "data": {
      "json": {
        "company_mission": "AI-powered web scraping and data extraction",
      },
      "metadata": {
        "title": "Firecrawl",
        "description": "AI-powered web scraping and data extraction",
        "robots": "follow, index",
        "ogTitle": "Firecrawl",
        "ogDescription": "AI-powered web scraping and data extraction",
        "ogUrl": "https://firecrawl.dev/",
        "ogImage": "https://firecrawl.dev/og.png",
        "ogLocaleAlternate": [],
        "ogSiteName": "Firecrawl",
        "sourceURL": "https://firecrawl.dev/"
      },
    }
}
```

### Real-world example: Extracting company information

Here's a comprehensive example extracting structured company information from a website:

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl
  from pydantic import BaseModel

  app = Firecrawl(api_key="fc-YOUR-API-KEY")

  class CompanyInfo(BaseModel):
      company_mission: str
      supports_sso: bool
      is_open_source: bool
      is_in_yc: bool

  result = app.scrape(
      'https://firecrawl.dev/',
      formats=[{
          "type": "json",
          "schema": CompanyInfo.model_json_schema()
      }]
  )

  print(result)
  ```

  ```js Node theme={null}
  import FirecrawlApp from "@mendable/firecrawl-js";
  import { z } from "zod";

  const app = new FirecrawlApp({
    apiKey: "fc-YOUR_API_KEY"
  });

  const companyInfoSchema = z.object({
    company_mission: z.string(),
    supports_sso: z.boolean(),
    is_open_source: z.boolean(),
    is_in_yc: z.boolean()
  });

  const result = await app.scrape("https://firecrawl.dev/", {
    formats: [{
      type: "json",
      schema: companyInfoSchema
    }]
  });

  console.log(result);
  ```

  ```bash cURL theme={null}
  curl -X POST https://api.firecrawl.dev/v2/scrape \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_API_KEY' \
      -d '{
        "url": "https://firecrawl.dev/",
        "formats": [{
          "type": "json",
          "schema": {
            "type": "object",
            "properties": {
              "company_mission": {
                "type": "string"
              },
              "supports_sso": {
                "type": "boolean"
              },
              "is_open_source": {
                "type": "boolean"
              },
              "is_in_yc": {
                "type": "boolean"
              }
            },
            "required": [
              "company_mission",
              "supports_sso",
              "is_open_source",
              "is_in_yc"
            ]
          }
        }]
      }'
  ```
</CodeGroup>

Output:

```json Output theme={null}
{
  "success": true,
  "data": {
    "json": {
      "company_mission": "Turn websites into LLM-ready data",
      "supports_sso": true,
      "is_open_source": true,
      "is_in_yc": true
    }
  }
}
```

### JSON format options

When using JSON mode in v2, include an object in `formats` with the schema embedded directly:

`formats: [{ type: 'json', schema: { ... }, prompt: '...' }]`

Parameters:

* `schema`: JSON Schema describing the structured output you want (required for schema-based extraction).
* `prompt`: Optional prompt to guide extraction (also used for no-schema extraction).

**Important:** Unlike v1, there is no separate `jsonOptions` parameter in v2. The schema must be included directly inside the format object in the `formats` array.


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt

# Change Tracking

> Firecrawl can track changes between the current page and a previous version, and tell you if it updated or not

<img src="https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/launch-week/lw3d12.webp?fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=cc56c24d15e1b2ed4806ddb66d0f5c3f" alt="Change Tracking" data-og-width="2400" width="2400" data-og-height="1350" height="1350" data-path="images/launch-week/lw3d12.webp" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/launch-week/lw3d12.webp?w=280&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=2f46113bc318badaeaf0fb32e7645df8 280w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/launch-week/lw3d12.webp?w=560&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=2fd31b621bcb393815715ce8fe1e5abd 560w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/launch-week/lw3d12.webp?w=840&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=2423ca2755bdb28f4d3e64e1abffebf6 840w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/launch-week/lw3d12.webp?w=1100&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=cc14d2752f8888824b84ea121fcbbb7d 1100w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/launch-week/lw3d12.webp?w=1650&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=2e8a59b9d8f69c378551f4c5ff20e13d 1650w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/launch-week/lw3d12.webp?w=2500&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=830c7f2a9465d9f6f3733a5289a5e9fe 2500w" />

Change tracking allows you to monitor and detect changes in web content over time. This feature is available in both the JavaScript and Python SDKs.

## Overview

Change tracking enables you to:

* Detect if a webpage has changed since the last scrape
* View the specific changes between scrapes
* Get structured data about what has changed
* Control the visibility of changes

Using the `changeTracking` format, you can monitor changes on a website and receive information about:

* `previousScrapeAt`: The timestamp of the previous scrape that the current page is being compared against (`null` if no previous scrape)
* `changeStatus`: The result of the comparison between the two page versions
  * `new`: This page did not exist or was not discovered before (usually has a `null` `previousScrapeAt`)
  * `same`: This page's content has not changed since the last scrape
  * `changed`: This page's content has changed since the last scrape
  * `removed`: This page was removed since the last scrape
* `visibility`: The visibility of the current page/URL
  * `visible`: This page is visible, meaning that its URL was discovered through an organic route (through links on other visible pages or the sitemap)
  * `hidden`: This page is not visible, meaning it is still available on the web, but no longer discoverable via the sitemap or crawling the site. We can only identify invisible links if they had been visible, and captured, during a previous crawl or scrape

## SDKs

### Basic Usage

To use change tracking, include `'changeTracking'` in the formats when scraping a URL:

<CodeGroup>
  ```js Node theme={null}
  const firecrawl = new Firecrawl({ apiKey: 'your-api-key' });
  const result = await firecrawl.scrape('https://example.com', {
    formats: ['markdown', 'changeTracking']
  });

  // Access change tracking data
  console.log(result.changeTracking)
  ```

  ```python Python theme={null}
  from firecrawl import Firecrawl
  from pydantic import BaseModel

  firecrawl = Firecrawl(api_key='your-api-key')
  result = firecrawl.scrape('https://example.com',
      formats=['markdown', 'change_tracking']
  )

  # Access change tracking data
  print("Change Tracking:", result.change_tracking)
  ```
</CodeGroup>

Example Response:

```json  theme={null}
{
  "url": "https://firecrawl.dev",
  "markdown": "# AI Agents for great customer experiences\n\nChatbots that delight your users...",
  "changeTracking": {
    "previousScrapeAt": "2025-04-10T12:00:00Z",
    "changeStatus": "changed",
    "visibility": "visible"
  }
}
```

### Advanced Options

You can configure change tracking by passing an object in the `formats` array:

<CodeGroup>
  ```js Node theme={null}
  const result = await firecrawl.scrape('https://example.com', {
    formats: [
      'markdown',
      {
        type: 'changeTracking',
        modes: ['git-diff', 'json'], // Enable specific change tracking modes
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' }
          }
        }, // Schema for structured JSON comparison
        prompt: 'Custom prompt for extraction', // Optional custom prompt
        tag: 'production' // Optional tag for separate change tracking histories
      }
    ]
  });

  // Access git-diff format changes
  if (result.changeTracking.diff) {
    console.log(result.changeTracking.diff.text); // Git-style diff text
    console.log(result.changeTracking.diff.json); // Structured diff data
  }

  // Access JSON comparison changes
  if (result.changeTracking.json) {
    console.log(result.changeTracking.json.title.previous); // Previous title
    console.log(result.changeTracking.json.title.current); // Current title
  }
  ```

  ```python Python theme={null}
  result = firecrawl.scrape('https://example.com',
      formats=[
          'markdown',
          {
              'type': 'change_tracking',
              'modes': ['git-diff', 'json'],  # Enable specific change tracking modes
              'schema': {
                  'type': 'object',
                  'properties': {
                      'title': {'type': 'string'},
                      'content': {'type': 'string'}
                  }
              },  # Schema for structured JSON comparison
              'prompt': 'Custom prompt for extraction',  # Optional custom prompt
              'tag': 'production'  # Optional tag for separate change tracking histories
          }
      ]
  )

  # Access git-diff format changes
  if 'diff' in result.change_tracking:
      print(result.change_tracking.diff.text)  # Git-style diff text
      print(result.change_tracking.diff.json)  # Structured diff data

  # Access JSON comparison changes
  if 'json' in result.change_tracking:
      print(result.change_tracking.json.title.previous)  # Previous title
      print(result.change_tracking.json.title.current)  # Current title
  ```
</CodeGroup>

### Git-Diff Results Example:

```
 **April, 13 2025**
 
-**05:55:05 PM**
+**05:58:57 PM**

...
```

### JSON Comparison Results Example:

```json  theme={null}
{
  "time": { 
    "previous": "2025-04-13T17:54:32Z", 
    "current": "2025-04-13T17:55:05Z" 
  }
}
```

### Data Models

The change tracking feature includes the following data models:

<CodeGroup>
  ```js Node theme={null}
  interface FirecrawlDocument {
    // ... other properties
    changeTracking?: {
      previousScrapeAt: string | null;
      changeStatus: "new" | "same" | "changed" | "removed";
      visibility: "visible" | "hidden";
      diff?: {
        text: string;
        json: {
          files: Array<{
            from: string | null;
            to: string | null;
            chunks: Array<{
              content: string;
              changes: Array<{
                type: string;
                normal?: boolean;
                ln?: number;
                ln1?: number;
                ln2?: number;
                content: string;
              }>;
            }>;
          }>;
        };
      };
      json?: any;
    };
  }

  interface ChangeTrackingFormat {
    type: 'changeTracking';
    prompt?: string;
    schema?: any;
    modes?: ("json" | "git-diff")[];
    tag?: string | null;
  }

  interface ScrapeParams {
    // ... other properties
    formats?: Array<'markdown' | 'html' | ChangeTrackingFormat>;
  }
  ```

  ```python Python theme={null}
  class ChangeTrackingData(BaseModel):
      """
      Data for the change tracking format.
      """
      previous_scrape_at: Optional[str] = None
      change_status: str  # "new" | "same" | "changed" | "removed"
      visibility: str  # "visible" | "hidden"
      diff: Optional[Dict[str, Any]] = None
      json: Optional[Dict[str, Any]] = None
  ```
</CodeGroup>

## Change Tracking Modes

The change tracking feature supports two modes:

### Git-Diff Mode

The `git-diff` mode provides a traditional diff format similar to Git's output. It shows line-by-line changes with additions and deletions marked.

Example output:

```
@@ -1,1 +1,1 @@
-old content
+new content
```

The structured JSON representation of the diff includes:

* `files`: Array of changed files (in web context, typically just one)
* `chunks`: Sections of changes within a file
* `changes`: Individual line changes with type (add, delete, normal)

### JSON Mode

The `json` mode provides a structured comparison of specific fields extracted from the content. This is useful for tracking changes in specific data points rather than the entire content.

Example output:

```json  theme={null}
{
  "title": {
    "previous": "Old Title",
    "current": "New Title"
  },
  "price": {
    "previous": "$19.99",
    "current": "$24.99"
  }
}
```

To use JSON mode, you need to provide a schema that defines the fields to extract and compare.

## Important Facts

Here are some important details to know when using the change tracking feature:

* **Comparison Method**: Scrapes are always compared via their markdown response.
  * The `markdown` format must also be specified when using the `changeTracking` format. Other formats may also be specified in addition.
  * The comparison algorithm is resistant to changes in whitespace and content order. iframe source URLs are currently ignored for resistance against captchas and antibots with randomized URLs.

* **Matching Previous Scrapes**: Previous scrapes to compare against are currently matched on the source URL, the team ID, the `markdown` format, and the `tag` parameter.
  * For an effective comparison, the input URL should be exactly the same as the previous request for the same content.
  * Crawling the same URLs with different `includePaths`/`excludePaths` will have inconsistencies when using `changeTracking`.
  * Scraping the same URLs with different `includeTags`/`excludeTags`/`onlyMainContent` will have inconsistencies when using `changeTracking`.
  * Compared pages will also be compared against previous scrapes that only have the `markdown` format without the `changeTracking` format.
  * Comparisons are scoped to your team. If you scrape a URL for the first time with your API key, its `changeStatus` will always be `new`, even if other Firecrawl users have scraped it before.

* **Beta Status**: While in Beta, it is recommended to monitor the `warning` field of the resulting document, and to handle the `changeTracking` object potentially missing from the response.
  * This may occur when the database lookup to find the previous scrape to compare against times out.

## Examples

### Basic Scrape Example

```json  theme={null}
// Request
{
    "url": "https://firecrawl.dev",
    "formats": ["markdown", "changeTracking"]
}

// Response
{
  "success": true,
  "data": {
    "markdown": "...",
    "metadata": {...},
    "changeTracking": {
      "previousScrapeAt": "2025-03-30T15:07:17.543071+00:00",
      "changeStatus": "same",
      "visibility": "visible"
    }
  }
}
```

### Crawl Example

```json  theme={null}
// Request
{
    "url": "https://firecrawl.dev",
    "scrapeOptions": {
        "formats": ["markdown", "changeTracking"]
    }
}
```

### Tracking Product Price Changes

<CodeGroup>
  ```js Node theme={null}
  const result = await firecrawl.scrape('https://example.com/product', {
    formats: [
      'markdown',
      {
        type: 'changeTracking',
        modes: ['json'],
        schema: {
          type: 'object',
          properties: {
            price: { type: 'string' },
            availability: { type: 'string' }
          }
        }
      }
    ]
  });

  if (result.changeTracking.changeStatus === 'changed') {
    console.log(`Price changed from ${result.changeTracking.json.price.previous} to ${result.changeTracking.json.price.current}`);
  }
  ```

  ```python Python theme={null}
  result = firecrawl.scrape('https://example.com/product',
      formats=[
          'markdown',
          {
              'type': 'change_tracking',
              'modes': ['json'],
              'schema': {
                  'type': 'object',
                  'properties': {
                      'price': {'type': 'string'},
                      'availability': {'type': 'string'}
                  }
              }
          }
      ]
  )

  if result.change_tracking.change_status == 'changed':
      print(f"Price changed from {result.change_tracking.json.price.previous} to {result.change_tracking.json.price.current}")
  ```
</CodeGroup>

### Monitoring Content Changes with Git-Diff

<CodeGroup>
  ```js Node theme={null}
  const result = await firecrawl.scrape('https://example.com/blog', {
    formats: [
      'markdown',
      { type: 'changeTracking', modes: ['git-diff'] }
    ]
  });

  if (result.changeTracking.changeStatus === 'changed') {
    console.log('Content changes:');
    console.log(result.changeTracking.diff.text);
  }
  ```

  ```python Python theme={null}
  result = firecrawl.scrape('https://example.com/blog',
      formats=[
          'markdown',
          { 'type': 'change_tracking', 'modes': ['git-diff'] }
      ]
  )

  if result.change_tracking.change_status == 'changed':
      print('Content changes:')
      print(result.change_tracking.diff.text)
  ```
</CodeGroup>

## Billing

The change tracking feature is currently in beta. Using the basic change tracking functionality and `git-diff` mode has no additional cost. However, if you use the `json` mode for structured data comparison, the page scrape will cost 5 credits per page.


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt

# Stealth Mode

> Use stealth proxies for sites with advanced anti-bot solutions

Firecrawl provides different proxy types to help you scrape websites with varying levels of anti-bot protection. The proxy type can be specified using the `proxy` parameter.

### Proxy Types

Firecrawl supports three types of proxies:

* **basic**: Proxies for scraping sites with none to basic anti-bot solutions. Fast and usually works.
* **stealth**: Stealth proxies for scraping sites with advanced anti-bot solutions. Slower, but more reliable on certain sites.
* **auto**: Firecrawl will automatically retry scraping with stealth proxies if the basic proxy fails. If the retry with stealth is successful, 5 credits will be billed for the scrape. If the first attempt with basic is successful, only the regular cost will be billed.

If you do not specify a proxy, Firecrawl will default to auto.

### Using Stealth Mode

When scraping websites with advanced anti-bot protection, you can use the stealth proxy mode to improve your success rate.

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key='fc-YOUR-API-KEY')

  # Choose proxy strategy: 'basic' | 'stealth' | 'auto'
  doc = firecrawl.scrape('https://example.com', formats=['markdown'], proxy='auto')

  print(doc.warning or 'ok')
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  // Choose proxy strategy: 'basic' | 'stealth' | 'auto'
  const doc = await firecrawl.scrape('https://example.com', {
    formats: ['markdown'],
    proxy: 'auto'
  });

  console.log(doc.warning || 'ok');
  ```

  ```bash cURL theme={null}

  // Choose proxy strategy: 'basic' | 'stealth' | 'auto'
  curl -X POST https://api.firecrawl.dev/v2/scrape \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer fc-YOUR-API-KEY' \
      -d '{
        "url": "https://example.com",
        "proxy": "auto"
      }'

  ```
</CodeGroup>

**Note:** Stealth proxy requests cost 5 credits per request when used.

## Using Stealth as a Retry Mechanism

A common pattern is to first try scraping with the default proxy settings, and then retry with stealth mode if you encounter specific error status codes (401, 403, or 500) in the `metadata.statusCode` field of the response. These status codes can be indicative of the website blocking your request.

<CodeGroup>
  ```python Python theme={null}
  # pip install firecrawl-py

  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="YOUR_API_KEY")

  # First try with basic proxy
  try:
      content = firecrawl.scrape("https://example.com")
      
      # Check if we got an error status code
      status_code = content.get("metadata", {}).get("statusCode")
      if status_code in [401, 403, 500]:
          print(f"Got status code {status_code}, retrying with stealth proxy")
          # Retry with stealth proxy
          content = firecrawl.scrape("https://example.com", proxy="stealth")
      
      print(content["markdown"])
  except Exception as e:
      print(f"Error: {e}")
      # Retry with stealth proxy on exception
      try:
          content = firecrawl.scrape("https://example.com", proxy="stealth")
          print(content["markdown"])
      except Exception as e:
          print(f"Stealth proxy also failed: {e}")
  ```

  ```js Node theme={null}
  // npm install @mendable/firecrawl-js

  import { Firecrawl } from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: 'YOUR_API_KEY' });

  // Function to scrape with retry logic
  async function scrapeWithRetry(url) {
    try {
      // First try with default proxy
      const content = await firecrawl.scrape(url);
      
      // Check if we got an error status code
      const statusCode = content?.metadata?.statusCode;
      if ([401, 403, 500].includes(statusCode)) {
        console.log(`Got status code ${statusCode}, retrying with stealth proxy`);
        // Retry with stealth proxy
        return await firecrawl.scrape(url, {
          proxy: 'stealth'
        });
      }
      
      return content;
    } catch (error) {
      console.error(`Error: ${error.message}`);
      // Retry with stealth proxy on exception
      try {
        return await firecrawl.scrape(url, {
          proxy: 'stealth'
        });
      } catch (retryError) {
        console.error(`Stealth proxy also failed: ${retryError.message}`);
        throw retryError;
      }
    }
  }

  // Usage
  const content = await scrapeWithRetry('https://example.com');
  console.log(content.markdown);
  ```

  ```bash cURL theme={null}
  # First try with default proxy
  RESPONSE=$(curl -s -X POST https://api.firecrawl.dev/v2/scrape \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_API_KEY' \
      -d '{
        "url": "https://example.com"
      }')

  # Extract status code from response
  STATUS_CODE=$(echo $RESPONSE | jq -r '.data.metadata.statusCode')

  # Check if status code indicates we should retry with stealth
  if [[ "$STATUS_CODE" == "401" || "$STATUS_CODE" == "403" || "$STATUS_CODE" == "500" ]]; then
      echo "Got status code $STATUS_CODE, retrying with stealth proxy"
      
      # Retry with stealth proxy
      curl -X POST https://api.firecrawl.dev/v2/scrape \
          -H 'Content-Type: application/json' \
          -H 'Authorization: Bearer YOUR_API_KEY' \
          -d '{
            "url": "https://example.com",
            "proxy": "stealth"
          }'
  else
      # Output the original response
      echo $RESPONSE
  fi
  ```
</CodeGroup>

This approach allows you to optimize your credit usage by only using stealth mode when necessary.


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt

# Proxies

> Learn about proxy types, locations, and how Firecrawl selects proxies for your requests.

Firecrawl provides different proxy types to help you scrape websites with varying levels of anti-bot protection. The proxy type can be specified using the `proxy` parameter.

> By default, Firecrawl routes all requests through proxies to help ensure reliability and access, even if you do not specify a proxy type or location.

## Location-Based Proxy Selection

Firecrawl automatically selects the best proxy based on your specified or detected location. This helps optimize scraping performance and reliability. However, not all locations are currently supported. The following locations are available:

| Country Code | Country Name         | Stealth Mode Support |
| ------------ | -------------------- | -------------------- |
| AE           | United Arab Emirates | No                   |
| AU           | Australia            | Yes                  |
| BR           | Brazil               | No                   |
| CA           | Canada               | No                   |
| CN           | China                | No                   |
| CZ           | Czechia              | No                   |
| DE           | Germany              | No                   |
| ES           | Spain                | No                   |
| FR           | France               | No                   |
| GB           | United Kingdom       | No                   |
| GR           | Greece               | No                   |
| HU           | Hungary              | No                   |
| ID           | Indonesia            | No                   |
| IL           | Israel               | No                   |
| IN           | India                | No                   |
| IT           | Italy                | No                   |
| JP           | Japan                | No                   |
| MY           | Malaysia             | No                   |
| NO           | Norway               | No                   |
| PL           | Poland               | No                   |
| PT           | Portugal             | No                   |
| QA           | Qatar                | No                   |
| SG           | Signapore            | No                   |
| TR           | Turkey               | No                   |
| US           | United States        | Yes                  |
| VN           | Vietnam              | No                   |

<Warning>The list of supported proxy locations was last updated on Dec 12, 2025. Availability may change over time.</Warning>

If you need proxies in a location not listed above, please [contact us](mailto:help@firecrawl.com) and let us know your requirements.

If you do not specify a proxy or location, Firecrawl will automatically use US proxies.

## How to Specify Proxy Location

You can request a specific proxy location by setting the `location.country` parameter in your request. For example, to use a Brazilian proxy, set `location.country` to `BR`.

For full details, see the [API reference for `location.country`](https://docs.firecrawl.dev/api-reference/endpoint/scrape#body-location).

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  doc = firecrawl.scrape('https://example.com',
      formats=['markdown'],
      location={
          'country': 'US',
          'languages': ['en']
      }
  )

  print(doc)
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const doc = await firecrawl.scrape('https://example.com', {
    formats: ['markdown'],
    location: { country: 'US', languages: ['en'] },
  });

  console.log(doc.metadata);
  ```

  ```bash cURL theme={null}
  curl -X POST "https://api.firecrawl.dev/v2/scrape" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://example.com",
      "formats": ["markdown"],
      "location": { "country": "US", "languages": ["en"] }
    }'
  ```
</CodeGroup>

<Info>If you request a country where a proxy is not available, Firecrawl will use the closest available region (EU or US) and set the browser location to your requested country.</Info>

## Proxy Types

Firecrawl supports three types of proxies:

* **basic**: Proxies for scraping sites with none to basic anti-bot solutions. Fast and usually works.
* **stealth**: Stealth proxies for scraping sites with advanced anti-bot solutions, or for sites that block regular proxies. Slower, but more reliable on certain sites. [Learn more about Stealth Mode →](/features/stealth-mode)
* **auto**: Firecrawl will automatically retry scraping with stealth proxies if the basic proxy fails. If the retry with stealth is successful, 5 credits will be billed for the scrape. If the first attempt with basic is successful, only the regular cost will be billed.

***

> **Note:** For detailed information on using stealth proxies, including credit costs and retry strategies, see the [Stealth Mode documentation](/features/stealth-mode).


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt

# Document Parsing

> Learn about document parsing capabilities.

Firecrawl provides powerful document parsing capabilities, allowing you to extract structured content from various document formats. This feature is particularly useful for processing files like spreadsheets, Word documents, and more.

## Supported Document Formats

Firecrawl currently supports the following document formats:

* **Excel Spreadsheets** (`.xlsx`, `.xls`)
  * Each worksheet is converted to an HTML table
  * Worksheets are separated by H2 headings with the sheet name
  * Preserves cell formatting and data types

* **Word Documents** (`.docx`, `.doc`, `.odt`, `.rtf`)
  * Extracts text content while preserving document structure
  * Maintains headings, paragraphs, lists, and tables
  * Preserves basic formatting and styling

* **PDF Documents** (`.pdf`)
  * Extracts text content with layout information
  * Preserves document structure including sections and paragraphs
  * Handles both text-based and scanned PDFs (with OCR support)
  * Priced at 1 credit per-page. See [Pricing](https://docs.firecrawl.dev/pricing) for details.

## How to Use Document Parsing

Document parsing in Firecrawl works automatically when you provide a URL that points to a supported document type. The system will detect the file type based on the URL extension or content-type header and process it accordingly.

### Example: Scraping an Excel File

```js Node theme={null}
import Firecrawl from '@mendable/firecrawl-js';

const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

const doc = await firecrawl.scrape('https://example.com/data.xlsx');

console.log(doc.markdown);
```

### Example: Scraping a Word Document

```js Node theme={null}
import Firecrawl from '@mendable/firecrawl-js';

const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

const doc = await firecrawl.scrape('https://example.com/data.docx');

console.log(doc.markdown);
```

## Output Format

All supported document types are converted to clean, structured markdown. For example, an Excel file with multiple sheets might be converted to:

```markdown  theme={null}
## Sheet1

| Name  | Value |
|-------|-------|
| Item 1 | 100   |
| Item 2 | 200   |

## Sheet2

| Date       | Description  |
|------------|--------------|
| 2023-01-01 | First quarter|
```


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt

# Search

> Search the web and get full content from results

Firecrawl's search API allows you to perform web searches and optionally scrape the search results in one operation.

* Choose specific output formats (markdown, HTML, links, screenshots)
* Search the web with customizable parameters (location, etc.)
* Optionally retrieve content from search results in various formats
* Control the number of results and set timeouts

For details, see the [Search Endpoint API Reference](https://docs.firecrawl.dev/api-reference/endpoint/search).

## Performing a Search with Firecrawl

### /search endpoint

Used to perform web searches and optionally retrieve content from the results.

### Installation

<CodeGroup>
  ```python Python theme={null}
  # pip install firecrawl-py

  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")
  ```

  ```js Node theme={null}
  # npm install @mendable/firecrawl-js

  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });
  ```
</CodeGroup>

### Basic Usage

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  results = firecrawl.search(
      query="firecrawl",
      limit=3,
  )
  print(results)
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const results = await firecrawl.search('firecrawl', {
    limit: 3,
    scrapeOptions: { formats: ['markdown'] }
  });
  console.log(results);
  ```

  ```bash  theme={null}
  curl -s -X POST "https://api.firecrawl.dev/v2/search" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "query": "firecrawl",
      "limit": 3
    }'
  ```
</CodeGroup>

### Response

SDKs will return the data object directly. cURL will return the complete payload.

```json JSON theme={null}
{
  "success": true,
  "data": {
    "web": [
      {
        "url": "https://www.firecrawl.dev/",
        "title": "Firecrawl - The Web Data API for AI",
        "description": "The web crawling, scraping, and search API for AI. Built for scale. Firecrawl delivers the entire internet to AI agents and builders.",
        "position": 1
      },
      {
        "url": "https://github.com/mendableai/firecrawl",
        "title": "mendableai/firecrawl: Turn entire websites into LLM-ready ... - GitHub",
        "description": "Firecrawl is an API service that takes a URL, crawls it, and converts it into clean markdown or structured data.",
        "position": 2
      },
      ...
    ],
    "images": [
      {
        "title": "Quickstart | Firecrawl",
        "imageUrl": "https://mintlify.s3.us-west-1.amazonaws.com/firecrawl/logo/logo.png",
        "imageWidth": 5814,
        "imageHeight": 1200,
        "url": "https://docs.firecrawl.dev/",
        "position": 1
      },
      ...
    ],
    "news": [
      {
        "title": "Y Combinator startup Firecrawl is ready to pay $1M to hire three AI agents as employees",
        "url": "https://techcrunch.com/2025/05/17/y-combinator-startup-firecrawl-is-ready-to-pay-1m-to-hire-three-ai-agents-as-employees/",
        "snippet": "It's now placed three new ads on YC's job board for “AI agents only” and has set aside a $1 million budget total to make it happen.",
        "date": "3 months ago",
        "position": 1
      },
      ...
    ]
  }
}
```

## Search result types

In addition to regular web results, Search supports specialized result types via the `sources` parameter:

* `web`: standard web results (default)
* `news`: news-focused results
* `images`: image search results

## Search Categories

Filter search results by specific categories using the `categories` parameter:

* `github`: Search within GitHub repositories, code, issues, and documentation
* `research`: Search academic and research websites (arXiv, Nature, IEEE, PubMed, etc.)
* `pdf`: Search for PDFs

### GitHub Category Search

Search specifically within GitHub repositories:

```bash cURL theme={null}
curl -X POST https://api.firecrawl.dev/v2/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fc-YOUR_API_KEY" \
  -d '{
    "query": "web scraping python",
    "categories": ["github"],
    "limit": 10
  }'
```

### Research Category Search

Search academic and research websites:

```bash cURL theme={null}
curl -X POST https://api.firecrawl.dev/v2/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fc-YOUR_API_KEY" \
  -d '{
    "query": "machine learning transformers",
    "categories": ["research"],
    "limit": 10
  }'
```

### Mixed Category Search

Combine multiple categories in one search:

```bash cURL theme={null}
curl -X POST https://api.firecrawl.dev/v2/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fc-YOUR_API_KEY" \
  -d '{
    "query": "neural networks",
    "categories": ["github", "research"],
    "limit": 15
  }'
```

### Category Response Format

Each search result includes a `category` field indicating its source:

```json  theme={null}
{
  "success": true,
  "data": {
    "web": [
      {
        "url": "https://github.com/example/neural-network",
        "title": "Neural Network Implementation",
        "description": "A PyTorch implementation of neural networks",
        "category": "github"
      },
      {
        "url": "https://arxiv.org/abs/2024.12345",
        "title": "Advances in Neural Network Architecture",
        "description": "Research paper on neural network improvements",
        "category": "research"
      }
    ]
  }
}
```

Examples:

```bash cURL theme={null}
curl -X POST https://api.firecrawl.dev/v2/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fc-YOUR_API_KEY" \
  -d '{
    "query": "openai",
    "sources": ["news"],
    "limit": 5
  }'
```

```bash cURL theme={null}
curl -X POST https://api.firecrawl.dev/v2/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fc-YOUR_API_KEY" \
  -d '{
    "query": "jupiter",
    "sources": ["images"],
    "limit": 8
  }'
```

### HD Image Search with Size Filtering

Use images operators to find high-resolution images:

```bash cURL theme={null}
curl -X POST https://api.firecrawl.dev/v2/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fc-YOUR_API_KEY" \
  -d '{
    "query": "sunset imagesize:1920x1080",
    "sources": ["images"],
    "limit": 5
  }'
```

```bash cURL theme={null}
curl -X POST https://api.firecrawl.dev/v2/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fc-YOUR_API_KEY" \
  -d '{
    "query": "mountain wallpaper larger:2560x1440",
    "sources": ["images"],
    "limit": 8
  }'
```

**Common HD resolutions:**

* `imagesize:1920x1080` - Full HD (1080p)
* `imagesize:2560x1440` - QHD (1440p)
* `imagesize:3840x2160` - 4K UHD
* `larger:1920x1080` - HD and above
* `larger:2560x1440` - QHD and above

## Search with Content Scraping

Search and retrieve content from the search results in one operation.

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR_API_KEY")

  # Search and scrape content
  results = firecrawl.search(
      "firecrawl web scraping",
      limit=3,
      scrape_options={
          "formats": ["markdown", "links"]
      }
  )
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const results = await firecrawl.search('firecrawl', {
    limit: 3,
    scrapeOptions: { formats: ['markdown'] }
  });
  console.log(results);
  ```

  ```bash cURL theme={null}
  curl -X POST https://api.firecrawl.dev/v2/search \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer fc-YOUR_API_KEY" \
    -d '{
      "query": "firecrawl web scraping",
      "limit": 3,
      "scrapeOptions": {
        "formats": ["markdown", "links"]
      }
    }'
  ```
</CodeGroup>

Every option in scrape endpoint is supported by this search endpoint through the `scrapeOptions` parameter.

### Response with Scraped Content

```json  theme={null}
{
  "success": true,
  "data": [
    {
      "title": "Firecrawl - The Ultimate Web Scraping API",
      "description": "Firecrawl is a powerful web scraping API that turns any website into clean, structured data for AI and analysis.",
      "url": "https://firecrawl.dev/",
      "markdown": "# Firecrawl\n\nThe Ultimate Web Scraping API\n\n## Turn any website into clean, structured data\n\nFirecrawl makes it easy to extract data from websites for AI applications, market research, content aggregation, and more...",
      "links": [
        "https://firecrawl.dev/pricing",
        "https://firecrawl.dev/docs",
        "https://firecrawl.dev/guides"
      ],
      "metadata": {
        "title": "Firecrawl - The Ultimate Web Scraping API",
        "description": "Firecrawl is a powerful web scraping API that turns any website into clean, structured data for AI and analysis.",
        "sourceURL": "https://firecrawl.dev/",
        "statusCode": 200
      }
    }
  ]
}
```

## Advanced Search Options

Firecrawl's search API supports various parameters to customize your search:

### Location Customization

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR_API_KEY")

  # Search with location settings (Germany)
  search_result = firecrawl.search(
      "web scraping tools",
      limit=5,
      location="Germany"
  )

  # Process the results
  for result in search_result.data:
      print(f"Title: {result['title']}")
      print(f"URL: {result['url']}")
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  // Search with location settings (Germany)
  const results = await firecrawl.search('web scraping tools', {
    limit: 5,
    location: "Germany"
  });

  // Process the results
  console.log(results);
  ```

  ```bash cURL theme={null}
  curl -X POST https://api.firecrawl.dev/v2/search \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer fc-YOUR_API_KEY" \
    -d '{
      "query": "web scraping tools",
      "limit": 5,
      "location": "Germany"
    }'
  ```
</CodeGroup>

### Time-Based Search

Use the `tbs` parameter to filter results by time:

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  results = firecrawl.search(
      query="firecrawl",
      limit=5,
      tbs="qdr:d",
  )
  print(len(results.get('web', [])))
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const results = await firecrawl.search('firecrawl', {
    limit: 5,
    tbs: 'qdr:d', // past day
  });

  console.log(results.web);
  ```

  ```bash cURL theme={null}
  curl -X POST https://api.firecrawl.dev/v2/search \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer fc-YOUR_API_KEY" \
    -d '{
      "query": "latest web scraping techniques",
      "limit": 5,
      "tbs": "qdr:w"
    }'
  ```
</CodeGroup>

Common `tbs` values:

* `qdr:h` - Past hour
* `qdr:d` - Past 24 hours
* `qdr:w` - Past week
* `qdr:m` - Past month
* `qdr:y` - Past year

For more precise time filtering, you can specify exact date ranges using the custom date range format:

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  # Initialize the client with your API key
  firecrawl = Firecrawl(api_key="fc-YOUR_API_KEY")

  # Search for results from December 2024
  search_result = firecrawl.search(
      "firecrawl updates",
      limit=10,
      tbs="cdr:1,cd_min:12/1/2024,cd_max:12/31/2024"
  )
  ```

  ```js JavaScript theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  // Initialize the client with your API key
  const firecrawl = new Firecrawl({apiKey: "fc-YOUR_API_KEY"});

  // Search for results from December 2024
  firecrawl.search("firecrawl updates", {
    limit: 10,
    tbs: "cdr:1,cd_min:12/1/2024,cd_max:12/31/2024"
  })
  .then(searchResult => {
    console.log(searchResult.data);
  });
  ```

  ```bash cURL theme={null}
  curl -X POST https://api.firecrawl.dev/v2/search \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer fc-YOUR_API_KEY" \
    -d '{
      "query": "firecrawl updates",
      "limit": 10,
      "tbs": "cdr:1,cd_min:12/1/2024,cd_max:12/31/2024"
    }'
  ```
</CodeGroup>

### Custom Timeout

Set a custom timeout for search operations:

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import FirecrawlApp

  # Initialize the client with your API key
  app = FirecrawlApp(api_key="fc-YOUR_API_KEY")

  # Set a 30-second timeout
  search_result = app.search(
      "complex search query",
      limit=10,
      timeout=30000  # 30 seconds in milliseconds
  )
  ```

  ```js JavaScript theme={null}
  import FirecrawlApp from '@mendable/firecrawl-js';

  // Initialize the client with your API key
  const app = new FirecrawlApp({apiKey: "fc-YOUR_API_KEY"});

  // Set a 30-second timeout
  app.search("complex search query", {
    limit: 10,
    timeout: 30000  // 30 seconds in milliseconds
  })
  .then(searchResult => {
    // Process results
    console.log(searchResult.data);
  });
  ```

  ```bash cURL theme={null}
  curl -X POST https://api.firecrawl.dev/v2/search \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer fc-YOUR_API_KEY" \
    -d '{
      "query": "complex search query",
      "limit": 10,
      "timeout": 30000
    }'
  ```
</CodeGroup>

## Cost Implications

The cost of a search is 2 credits per 10 search results. If scraping options are enabled, the standard scraping costs apply to each search result:

* **Basic scrape**: 1 credit per webpage
* **PDF parsing**: 1 credit per PDF page
* **Stealth proxy mode**: 4 additional credits per webpage
* **JSON mode**: 4 additional credits per webpage

To help control costs:

* Set `parsers: []` if PDF parsing isn’t required
* Use `proxy: "basic"` instead of `"stealth"` when possible, or set it to `"auto"`
* Limit the number of search results with the `limit` parameter

## Advanced Scraping Options

For more details about the scraping options, refer to the [Scrape Feature documentation](https://docs.firecrawl.dev/features/scrape). Everything except for the FIRE-1 Agent and Change-Tracking features are supported by this Search endpoint.


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt

# Map

> Input a website and get all the urls on the website - extremely fast

## Introducing /map

The easiest way to go from a single url to a map of the entire website. This is extremely useful for:

* When you need to prompt the end-user to choose which links to scrape
* Need to quickly know the links on a website
* Need to scrape pages of a website that are related to a specific topic (use the `search` parameter)
* Only need to scrape specific pages of a website

## Mapping

### /map endpoint

Used to map a URL and get urls of the website. This returns most links present on the website.

### Installation

<CodeGroup>
  ```python Python theme={null}
  # pip install firecrawl-py

  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")
  ```

  ```js Node theme={null}
  # npm install @mendable/firecrawl-js

  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });
  ```
</CodeGroup>

### Usage

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")
  res = firecrawl.map(url="https://firecrawl.dev", limit=50, sitemap="include")
  print(res)
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const res = await firecrawl.map('https://firecrawl.dev', { limit: 50, sitemap: 'include' });
  console.log(res);
  ```
</CodeGroup>

### Response

SDKs will return the data object directly. cURL will return the payload exactly as shown below.

```json  theme={null}
{
  "success": true,
  "links": [
    {
      "url": "https://docs.firecrawl.dev/features/scrape",
      "title": "Scrape | Firecrawl",
      "description": "Turn any url into clean data"
    },
    {
      "url": "https://www.firecrawl.dev/blog/5_easy_ways_to_access_glm_4_5",
      "title": "5 Easy Ways to Access GLM-4.5",
      "description": "Discover how to access GLM-4.5 models locally, through chat applications, via the official API, and using the LLM marketplaces API for seamless integration i..."
    },
    {
      "url": "https://www.firecrawl.dev/playground",
      "title": "Playground - Firecrawl",
      "description": "Preview the API response and get the code snippets for the API"
    },
    {
      "url": "https://www.firecrawl.dev/?testId=2a7e0542-077b-4eff-bec7-0130395570d6",
      "title": "Firecrawl - The Web Data API for AI",
      "description": "The web crawling, scraping, and search API for AI. Built for scale. Firecrawl delivers the entire internet to AI agents and builders. Clean, structured, and ..."
    },
    {
      "url": "https://www.firecrawl.dev/?testId=af391f07-ca0e-40d3-8ff2-b1ecf2e3fcde",
      "title": "Firecrawl - The Web Data API for AI",
      "description": "The web crawling, scraping, and search API for AI. Built for scale. Firecrawl delivers the entire internet to AI agents and builders. Clean, structured, and ..."
    },
    ...
  ]
}
```

<Warning>
  Title and description are not always present as it depends on the website.
</Warning>

#### Map with search

Map with `search` param allows you to search for specific urls inside a website.

```bash cURL theme={null}
curl -X POST https://api.firecrawl.dev/v2/map \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{
    "url": "https://firecrawl.dev",
    "search": "docs"
  }'
```

Response will be an ordered list from the most relevant to the least relevant.

```json  theme={null}
{
  "status": "success",
  "links": [
    {
      "url": "https://docs.firecrawl.dev",
      "title": "Firecrawl Docs",
      "description": "Firecrawl documentation"
    },
    {
      "url": "https://docs.firecrawl.dev/sdks/python",
      "title": "Firecrawl Python SDK",
      "description": "Firecrawl Python SDK documentation"
    },
    ...
  ]
}
```

## Location and Language

Specify country and preferred languages to get relevant content based on your target location and language preferences, similar to the scrape endpoint.

### How it works

When you specify the location settings, Firecrawl will use an appropriate proxy if available and emulate the corresponding language and timezone settings. By default, the location is set to 'US' if not specified.

### Usage

To use the location and language settings, include the `location` object in your request body with the following properties:

* `country`: ISO 3166-1 alpha-2 country code (e.g., 'US', 'AU', 'DE', 'JP'). Defaults to 'US'.
* `languages`: An array of preferred languages and locales for the request in order of priority. Defaults to the language of the specified location.

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  res = firecrawl.map('https://example.com',
      location={
          'country': 'US',
          'languages': ['en']
      }
  )

  print(res)
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const res = await firecrawl.map('https://example.com', {
    location: { country: 'US', languages: ['en'] },
  });

  console.log(res.metadata);
  ```

  ```bash cURL theme={null}
  curl -X POST "https://api.firecrawl.dev/v2/map" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://example.com",
      "location": { "country": "US", "languages": ["en"] }
    }'
  ```
</CodeGroup>

For more details about supported locations, refer to the [Proxies documentation](/features/proxies).

## Considerations

This endpoint prioritizes speed, so it may not capture all website links. We are working on improvements. Feedback and suggestions are very welcome.


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt

# Crawl

> Firecrawl can recursively search through a urls subdomains, and gather the content

Firecrawl efficiently crawls websites to extract comprehensive data while bypassing blockers. The process:

1. **URL Analysis:** Scans sitemap and crawls website to identify links
2. **Traversal:** Recursively follows links to find all subpages
3. **Scraping:** Extracts content from each page, handling JS and rate limits
4. **Output:** Converts data to clean markdown or structured format

This ensures thorough data collection from any starting URL.

## Crawling

### /crawl endpoint

Used to crawl a URL and all accessible subpages. This submits a crawl job and returns a job ID to check the status of the crawl.

<Warning>
  By default - Crawl will ignore sublinks of a page if they aren't children of
  the url you provide. So, the website.com/other-parent/blog-1 wouldn't be
  returned if you crawled website.com/blogs/. If you want
  website.com/other-parent/blog-1, use the `crawlEntireDomain` parameter. To
  crawl subdomains like blog.website.com when crawling website.com, use the
  `allowSubdomains` parameter.
</Warning>

### Installation

<CodeGroup>
  ```python Python theme={null}
  # pip install firecrawl-py

  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")
  ```

  ```js Node theme={null}
  # npm install @mendable/firecrawl-js

  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });
  ```
</CodeGroup>

### Usage

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  docs = firecrawl.crawl(url="https://docs.firecrawl.dev", limit=10)
  print(docs)
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const docs = await firecrawl.crawl('https://docs.firecrawl.dev', { limit: 10 });
  console.log(docs);
  ```

  ```bash cURL theme={null}
  curl -s -X POST "https://api.firecrawl.dev/v2/crawl" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://docs.firecrawl.dev",
      "limit": 10
    }'
  ```
</CodeGroup>

### Scrape options in crawl

All options from the Scrape endpoint are available in Crawl via `scrapeOptions` (JS) / `scrape_options` (Python). These apply to every page the crawler scrapes: formats, proxy, caching, actions, location, tags, etc. See the full list in the [Scrape API Reference](https://docs.firecrawl.dev/api-reference/endpoint/scrape).

<CodeGroup>
  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: 'fc-YOUR_API_KEY' });

  // Crawl with scrape options
  const crawlResponse = await firecrawl.crawl('https://example.com', {
    limit: 100,
    scrapeOptions: {
      formats: [
        'markdown',
        {
          type: 'json',
          schema: { type: 'object', properties: { title: { type: 'string' } } },
        },
      ],
      proxy: 'auto',
      maxAge: 600000,
      onlyMainContent: true,
    },
  });
  ```

  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key='fc-YOUR_API_KEY')

  # Crawl with scrape options
  response = firecrawl.crawl('https://example.com',
      limit=100,
      scrape_options={
          'formats': [
              'markdown',
              { 'type': 'json', 'schema': { 'type': 'object', 'properties': { 'title': { 'type': 'string' } } } }
          ],
          'proxy': 'auto',
          'maxAge': 600000,
          'onlyMainContent': True
      }
  )
  ```
</CodeGroup>

### API Response

If you're using cURL or the starter method, this will return an `ID` to check the status of the crawl.

<Note>
  If you're using the SDK, see methods below for waiter vs starter behavior.
</Note>

```json  theme={null}
{
  "success": true,
  "id": "123-456-789",
  "url": "https://api.firecrawl.dev/v2/crawl/123-456-789"
}
```

### Check Crawl Job

Used to check the status of a crawl job and get its result.

<Note>
  This endpoint only works for crawls that are in progress or crawls that have
  completed recently.{' '}
</Note>

<CodeGroup>
  ```python Python theme={null}
  status = firecrawl.get_crawl_status("<crawl-id>")
  print(status)
  ```

  ```js Node theme={null}
  const status = await firecrawl.getCrawlStatus("<crawl-id>");
  console.log(status);
  ```

  ```bash cURL theme={null}
  # After starting a crawl, poll status by jobId
  curl -s -X GET "https://api.firecrawl.dev/v2/crawl/<jobId>" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY"
  ```
</CodeGroup>

#### Response Handling

The response varies based on the crawl's status.

For not completed or large responses exceeding 10MB, a `next` URL parameter is provided. You must request this URL to retrieve the next 10MB of data. If the `next` parameter is absent, it indicates the end of the crawl data.

The skip parameter sets the maximum number of results returned for each chunk of results returned.

<Info>
  The skip and next parameter are only relavent when hitting the api directly.
  If you're using the SDK, we handle this for you and will return all the
  results at once.
</Info>

<CodeGroup>
  ```json Scraping theme={null}
  {
    "status": "scraping",
    "total": 36,
    "completed": 10,
    "creditsUsed": 10,
    "expiresAt": "2024-00-00T00:00:00.000Z",
    "next": "https://api.firecrawl.dev/v2/crawl/123-456-789?skip=10",
    "data": [
      {
        "markdown": "[Firecrawl Docs home page![light logo](https://mintlify.s3-us-west-1.amazonaws.com/firecrawl/logo/light.svg)!...",
        "html": "<!DOCTYPE html><html lang=\"en\" class=\"js-focus-visible lg:[--scroll-mt:9.5rem]\" data-js-focus-visible=\"\">...",
        "metadata": {
          "title": "Build a 'Chat with website' using Groq Llama 3 | Firecrawl",
          "language": "en",
          "sourceURL": "https://docs.firecrawl.dev/learn/rag-llama3",
          "description": "Learn how to use Firecrawl, Groq Llama 3, and Langchain to build a 'Chat with your website' bot.",
          "ogLocaleAlternate": [],
          "statusCode": 200
        }
      },
      ...
    ]
  }
  ```

  ```json Completed theme={null}
  {
    "status": "completed",
    "total": 36,
    "completed": 36,
    "creditsUsed": 36,
    "expiresAt": "2024-00-00T00:00:00.000Z",
    "next": "https://api.firecrawl.dev/v2/crawl/123-456-789?skip=26",
    "data": [
      {
        "markdown": "[Firecrawl Docs home page![light logo](https://mintlify.s3-us-west-1.amazonaws.com/firecrawl/logo/light.svg)!...",
        "html": "<!DOCTYPE html><html lang=\"en\" class=\"js-focus-visible lg:[--scroll-mt:9.5rem]\" data-js-focus-visible=\"\">...",
        "metadata": {
          "title": "Build a 'Chat with website' using Groq Llama 3 | Firecrawl",
          "language": "en",
          "sourceURL": "https://docs.firecrawl.dev/learn/rag-llama3",
          "description": "Learn how to use Firecrawl, Groq Llama 3, and Langchain to build a 'Chat with your website' bot.",
          "ogLocaleAlternate": [],
          "statusCode": 200
        }
      },
      ...
    ]
  }
  ```
</CodeGroup>

### SDK methods

There are two ways to use the SDK:

1. **Crawl then wait** (`crawl`):
   * Waits for the crawl to complete and returns the full response
   * Handles pagination automatically
   * Recommended for most use cases

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl
  from firecrawl.types import ScrapeOptions

  firecrawl = Firecrawl(api_key="fc-YOUR_API_KEY")

  # Crawl a website:
  crawl_status = firecrawl.crawl(
    'https://firecrawl.dev', 
    limit=100, 
    scrape_options=ScrapeOptions(formats=['markdown', 'html']),
    poll_interval=30
  )
  print(crawl_status)
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({apiKey: "fc-YOUR_API_KEY"});

  const crawlResponse = await firecrawl.crawl('https://firecrawl.dev', {
    limit: 100,
    scrapeOptions: {
      formats: ['markdown', 'html'],
    }
  })

  console.log(crawlResponse)
  ```
</CodeGroup>

The response includes the crawl status and all scraped data:

<CodeGroup>
  ```bash Python theme={null}
  success=True
  status='completed'
  completed=100
  total=100
  creditsUsed=100
  expiresAt=datetime.datetime(2025, 4, 23, 19, 21, 17, tzinfo=TzInfo(UTC))
  next=None
  data=[
    Document(
      markdown='[Day 7 - Launch Week III.Integrations DayApril 14th to 20th](...',
      metadata={
        'title': '15 Python Web Scraping Projects: From Beginner to Advanced',
        ...
        'scrapeId': '97dcf796-c09b-43c9-b4f7-868a7a5af722',
        'sourceURL': 'https://www.firecrawl.dev/blog/python-web-scraping-projects',
        'url': 'https://www.firecrawl.dev/blog/python-web-scraping-projects',
        'statusCode': 200
      }
    ),
    ...
  ]
  ```

  ```json Node theme={null}
  {
    success: true,
    status: "completed",
    completed: 100,
    total: 100,
    creditsUsed: 100,
    expiresAt: "2025-04-23T19:28:45.000Z",
    data: [
      {
        markdown: "[Day 7 - Launch Week III.Integrations DayApril ...",
        html: `<!DOCTYPE html><html lang="en" class="light" style="color...`,
        metadata: [Object],
      },
      ...
    ]
  }
  ```
</CodeGroup>

2. **Start then check status** (`startCrawl`/`start_crawl`):
   * Returns immediately with a crawl ID
   * Allows manual status checking
   * Useful for long-running crawls or custom polling logic

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  job = firecrawl.start_crawl(url="https://docs.firecrawl.dev", limit=10)
  print(job)

  # Check the status of the crawl
  status = firecrawl.get_crawl_status(job.id)
  print(status)
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const { id } = await firecrawl.startCrawl('https://docs.firecrawl.dev', { limit: 10 });
  console.log(id);

  // Check the status of the crawl
  const status = await firecrawl.getCrawlStatus(id);
  console.log(status);

  ```

  ```bash cURL theme={null}
  curl -s -X POST "https://api.firecrawl.dev/v2/crawl" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://docs.firecrawl.dev",
      "limit": 10
    }'
  ```
</CodeGroup>

## Crawl WebSocket

Firecrawl's WebSocket-based method, `Crawl URL and Watch`, enables real-time data extraction and monitoring. Start a crawl with a URL and customize it with options like page limits, allowed domains, and output formats, ideal for immediate data processing needs.

<CodeGroup>
  ```python Python theme={null}
  import asyncio
  from firecrawl import AsyncFirecrawl

  async def main():
      firecrawl = AsyncFirecrawl(api_key="fc-YOUR-API-KEY")

      # Start a crawl first
      started = await firecrawl.start_crawl("https://firecrawl.dev", limit=5)

      # Watch updates (snapshots) until terminal status
      async for snapshot in firecrawl.watcher(started.id, kind="crawl", poll_interval=2, timeout=120):
          if snapshot.status == "completed":
              print("DONE", snapshot.status)
              for doc in snapshot.data:
                  print("DOC", doc.metadata.source_url if doc.metadata else None)
          elif snapshot.status == "failed":
              print("ERR", snapshot.status)
          else:
              print("STATUS", snapshot.status, snapshot.completed, "/", snapshot.total)

  asyncio.run(main())
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: 'fc-YOUR-API-KEY' });

  // Start a crawl and then watch it
  const { id } = await firecrawl.startCrawl('https://mendable.ai', {
    excludePaths: ['blog/*'],
    limit: 5,
  });

  const watcher = firecrawl.watcher(id, { kind: 'crawl', pollInterval: 2, timeout: 120 });

  watcher.on('document', (doc) => {
    console.log('DOC', doc);
  });

  watcher.on('error', (err) => {
    console.error('ERR', err?.error || err);
  });

  watcher.on('done', (state) => {
    console.log('DONE', state.status);
  });

  // Begin watching (WS with HTTP fallback)
  await watcher.start();
  ```
</CodeGroup>

## Crawl Webhook

You can configure webhooks to receive real-time notifications as your crawl progresses. This allows you to process pages as they're scraped instead of waiting for the entire crawl to complete.

```bash cURL theme={null}
curl -X POST https://api.firecrawl.dev/v2/crawl \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer YOUR_API_KEY' \
    -d '{
      "url": "https://docs.firecrawl.dev",
      "limit": 100,
      "webhook": {
        "url": "https://your-domain.com/webhook",
        "metadata": {
          "any_key": "any_value"
        },
        "events": ["started", "page", "completed"]
      }
    }'
```

For comprehensive webhook documentation including event types, payload structure, and implementation examples, see the [Webhooks documentation](/webhooks/overview).

### Quick Reference

**Event Types:**

* `crawl.started` - When the crawl begins
* `crawl.page` - For each page successfully scraped
* `crawl.completed` - When the crawl finishes
* `crawl.failed` - If the crawl encounters an error

**Basic Payload:**

```json  theme={null}
{
  "success": true,
  "type": "crawl.page",
  "id": "crawl-job-id",
  "data": [...], // Page data for 'page' events
  "metadata": {}, // Your custom metadata
  "error": null
}
```

<Note>
  For detailed webhook configuration, security best practices, and
  troubleshooting, visit the [Webhooks documentation](/webhooks/overview).
</Note>


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt

