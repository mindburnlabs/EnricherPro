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

# Gemini

> Use Firecrawl with Google's Gemini AI for web scraping + AI workflows

Integrate Firecrawl with Google's Gemini for AI applications powered by web data.

## Setup

```bash  theme={null}
npm install @mendable/firecrawl-js @google/genai
```

Create `.env` file:

```bash  theme={null}
FIRECRAWL_API_KEY=your_firecrawl_key
GEMINI_API_KEY=your_gemini_key
```

> **Note:** If using Node \< 20, install `dotenv` and add `import 'dotenv/config'` to your code.

## Scrape + Summarize

This example demonstrates a simple workflow: scrape a website and summarize the content using Gemini.

```typescript  theme={null}
import FirecrawlApp from '@mendable/firecrawl-js';
import { GoogleGenAI } from '@google/genai';

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const scrapeResult = await firecrawl.scrape('https://firecrawl.dev', {
    formats: ['markdown']
});

console.log('Scraped content length:', scrapeResult.markdown?.length);

const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Summarize: ${scrapeResult.markdown}`,
});

console.log('Summary:', response.text);
```

## Content Analysis

This example shows how to analyze website content using Gemini's multi-turn conversation capabilities.

```typescript  theme={null}
import FirecrawlApp from '@mendable/firecrawl-js';
import { GoogleGenAI } from '@google/genai';

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const scrapeResult = await firecrawl.scrape('https://news.ycombinator.com/', {
    formats: ['markdown']
});

console.log('Scraped content length:', scrapeResult.markdown?.length);

const chat = ai.chats.create({
    model: 'gemini-2.5-flash'
});

// Ask for the top 3 stories on Hacker News
const result1 = await chat.sendMessage({
    message: `Based on this website content from Hacker News, what are the top 3 stories right now?\n\n${scrapeResult.markdown}`
});
console.log('Top 3 Stories:', result1.text);

// Ask for the 4th and 5th stories on Hacker News
const result2 = await chat.sendMessage({
    message: `Now, what are the 4th and 5th top stories on Hacker News from the same content?`
});
console.log('4th and 5th Stories:', result2.text);
```

## Structured Extraction

This example demonstrates how to extract structured data using Gemini's JSON mode from scraped website content.

```typescript  theme={null}
import FirecrawlApp from '@mendable/firecrawl-js';
import { GoogleGenAI, Type } from '@google/genai';

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const scrapeResult = await firecrawl.scrape('https://stripe.com', {
    formats: ['markdown']
});

console.log('Scraped content length:', scrapeResult.markdown?.length);

const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Extract company information: ${scrapeResult.markdown}`,
    config: {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING },
                industry: { type: Type.STRING },
                description: { type: Type.STRING },
                products: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            },
            propertyOrdering: ['name', 'industry', 'description', 'products']
        }
    }
});

console.log('Extracted company info:', response?.text);
```

For more examples, check the [Gemini documentation](https://ai.google.dev/docs).


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt

# Agent Development Kit (ADK)

> Integrate Firecrawl with Google's ADK using MCP for advanced agent workflows

Integrate Firecrawl with Google's Agent Development Kit (ADK) to build powerful AI agents with web scraping capabilities through the Model Context Protocol (MCP).

## Overview

Firecrawl provides an MCP server that seamlessly integrates with Google's ADK, enabling your agents to efficiently scrape, crawl, and extract structured data from any website. The integration supports both cloud-based and self-hosted Firecrawl instances with streamable HTTP for optimal performance.

## Features

* Efficient web scraping, crawling, and content discovery from any website
* Advanced search capabilities and intelligent content extraction
* Deep research and high-volume batch scraping
* Flexible deployment (cloud-based or self-hosted)
* Optimized for modern web environments with streamable HTTP support

## Prerequisites

* Obtain an API key for Firecrawl from [firecrawl.dev](https://firecrawl.dev)
* Install Google ADK

## Setup

<CodeGroup>
  ```python Remote MCP Server theme={null}
  from google.adk.agents.llm_agent import Agent
  from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPServerParams
  from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset

  FIRECRAWL_API_KEY = "YOUR-API-KEY"

  root_agent = Agent(
      model="gemini-2.5-pro",
      name="firecrawl_agent",
      description='A helpful assistant for scraping websites with Firecrawl',
      instruction='Help the user search for website content',
      tools=[
          MCPToolset(
              connection_params=StreamableHTTPServerParams(
                  url=f"https://mcp.firecrawl.dev/{FIRECRAWL_API_KEY}/v2/mcp",
              ),
          )
      ],
  )
  ```

  ```python Local MCP Server theme={null}
  from google.adk.agents.llm_agent import Agent
  from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
  from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset
  from mcp import StdioServerParameters

  root_agent = Agent(
      model='gemini-2.5-pro',
      name='firecrawl_agent',
      description='A helpful assistant for scraping websites with Firecrawl',
      instruction='Help the user search for website content',
      tools=[
          MCPToolset(
              connection_params=StdioConnectionParams(
                  server_params = StdioServerParameters(
                      command='npx',
                      args=[
                          "-y",
                          "firecrawl-mcp",
                      ],
                      env={
                          "FIRECRAWL_API_KEY": "YOUR-API-KEY",
                      }
                  ),
                  timeout=30,
              ),
          )
      ],
  )
  ```
</CodeGroup>

## Available Tools

| Tool               | Name                           | Description                                                                          |
| ------------------ | ------------------------------ | ------------------------------------------------------------------------------------ |
| Scrape Tool        | `firecrawl_scrape`             | Scrape content from a single URL with advanced options                               |
| Batch Scrape Tool  | `firecrawl_batch_scrape`       | Scrape multiple URLs efficiently with built-in rate limiting and parallel processing |
| Check Batch Status | `firecrawl_check_batch_status` | Check the status of a batch operation                                                |
| Map Tool           | `firecrawl_map`                | Map a website to discover all indexed URLs on the site                               |
| Search Tool        | `firecrawl_search`             | Search the web and optionally extract content from search results                    |
| Crawl Tool         | `firecrawl_crawl`              | Start an asynchronous crawl with advanced options                                    |
| Check Crawl Status | `firecrawl_check_crawl_status` | Check the status of a crawl job                                                      |
| Extract Tool       | `firecrawl_extract`            | Extract structured information from web pages using LLM capabilities                 |

## Configuration

### Required Configuration

**FIRECRAWL\_API\_KEY**: Your Firecrawl API key

* Required when using cloud API (default)
* Optional when using self-hosted instance with FIRECRAWL\_API\_URL

### Optional Configuration

**Firecrawl API URL (for self-hosted instances)**:

* `FIRECRAWL_API_URL`: Custom API endpoint
* Example: `https://firecrawl.your-domain.com`
* If not provided, the cloud API will be used

**Retry configuration**:

* `FIRECRAWL_RETRY_MAX_ATTEMPTS`: Maximum retry attempts (default: 3)
* `FIRECRAWL_RETRY_INITIAL_DELAY`: Initial delay in milliseconds (default: 1000)
* `FIRECRAWL_RETRY_MAX_DELAY`: Maximum delay in milliseconds (default: 10000)
* `FIRECRAWL_RETRY_BACKOFF_FACTOR`: Exponential backoff multiplier (default: 2)

**Credit usage monitoring**:

* `FIRECRAWL_CREDIT_WARNING_THRESHOLD`: Warning threshold (default: 1000)
* `FIRECRAWL_CREDIT_CRITICAL_THRESHOLD`: Critical threshold (default: 100)

## Example: Web Research Agent

```python  theme={null}
from google.adk.agents.llm_agent import Agent
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPServerParams
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset

FIRECRAWL_API_KEY = "YOUR-API-KEY"

# Create a research agent
research_agent = Agent(
    model="gemini-2.5-pro",
    name="research_agent",
    description='An AI agent that researches topics by scraping and analyzing web content',
    instruction='''You are a research assistant. When given a topic or question:
    1. Use the search tool to find relevant websites
    2. Scrape the most relevant pages for detailed information
    3. Extract structured data when needed
    4. Provide comprehensive, well-sourced answers''',
    tools=[
        MCPToolset(
            connection_params=StreamableHTTPServerParams(
                url=f"https://mcp.firecrawl.dev/{FIRECRAWL_API_KEY}/v2/mcp",
            ),
        )
    ],
)

# Use the agent
response = research_agent.run("What are the latest features in Python 3.13?")
print(response)
```

## Best Practices

1. **Use the right tool for the job**:
   * `firecrawl_search` when you need to find relevant pages first
   * `firecrawl_scrape` for single pages
   * `firecrawl_batch_scrape` for multiple known URLs
   * `firecrawl_crawl` for discovering and scraping entire sites

2. **Monitor your usage**: Configure credit thresholds to avoid unexpected usage

3. **Handle errors gracefully**: Configure retry settings based on your use case

4. **Optimize performance**: Use batch operations when scraping multiple URLs

***

## Related Resources

<CardGroup cols={2}>
  <Card title="Comprehensive Guide to Building AI Agents Using Google Agent Development Kit (ADK) and Firecrawl" href="https://www.firecrawl.dev/blog/google-adk-multi-agent-tutorial">
    Learn how to build powerful multi-agent AI systems using Google's ADK framework with Firecrawl for web scraping capabilities.
  </Card>

  <Card title="MCP Server Documentation" href="https://docs.firecrawl.dev/mcp-server">
    Learn more about Firecrawl's Model Context Protocol (MCP) server integration and capabilities.
  </Card>

  <Card title="Google ADK Official Documentation" href="https://google.github.io/adk-docs/">
    Explore the official Google Agent Development Kit documentation for comprehensive guides and API references.
  </Card>
</CardGroup>


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt

# Vercel AI SDK

> Firecrawl tools for Vercel AI SDK v5. Web scraping, search, crawling, and data extraction for AI applications.

Firecrawl tools for Vercel AI SDK v5. Web scraping, search, crawling, and data extraction for AI applications.

## Install

```bash  theme={null}
npm install firecrawl-aisdk ai @ai-sdk/openai
```

Set environment variables:

```bash  theme={null}
FIRECRAWL_API_KEY=fc-your-key
OPENAI_API_KEY=sk-your-key
```

<Note>
  These examples use OpenAI, but Firecrawl tools work with any Vercel AI SDK provider including Anthropic, Google, Mistral, and more. See the full list of [supported providers](https://ai-sdk.dev/providers/ai-sdk-providers).
</Note>

## Quick Start

```typescript  theme={null}
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { scrapeTool } from 'firecrawl-aisdk';

const { text } = await generateText({
  model: openai('gpt-5-mini'),
  prompt: 'Scrape https://firecrawl.dev and summarize what it does',
  tools: { scrape: scrapeTool },
});
```

## Available Tools

```typescript  theme={null}
import {
  scrapeTool,         // Scrape single URL
  searchTool,         // Search the web
  mapTool,            // Discover URLs on a site
  crawlTool,          // Crawl multiple pages
  batchScrapeTool,    // Scrape multiple URLs
  extractTool,        // Extract structured data
  pollTool,           // Poll async jobs
  statusTool,         // Check job status
  cancelTool,         // Cancel jobs
} from 'firecrawl-aisdk';
```

## Examples

### Scrape

```typescript  theme={null}
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { scrapeTool } from 'firecrawl-aisdk';

const { text } = await generateText({
  model: openai('gpt-5-mini'),
  prompt: 'Scrape https://firecrawl.dev and summarize what it does',
  tools: { scrape: scrapeTool },
});

console.log(text);
```

### Search

```typescript  theme={null}
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { searchTool } from 'firecrawl-aisdk';

const { text } = await generateText({
  model: openai('gpt-5-mini'),
  prompt: 'Search for Firecrawl and summarize what you find',
  tools: { search: searchTool },
});

console.log(text);
```

### Map

```typescript  theme={null}
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { mapTool } from 'firecrawl-aisdk';

const { text } = await generateText({
  model: openai('gpt-5-mini'),
  prompt: 'Map https://docs.firecrawl.dev and list the main sections',
  tools: { map: mapTool },
});

console.log(text);
```

### Crawl

Async operation - include `pollTool` to check job status.

```typescript  theme={null}
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { crawlTool, pollTool } from 'firecrawl-aisdk';

const { text } = await generateText({
  model: openai('gpt-5-mini'),
  prompt: 'Crawl https://docs.firecrawl.dev (limit 3 pages) and summarize',
  tools: { crawl: crawlTool, poll: pollTool },
});

console.log(text);
```

### Batch Scrape

Async operation - include `pollTool` to check job status.

```typescript  theme={null}
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { batchScrapeTool, pollTool } from 'firecrawl-aisdk';

const { text } = await generateText({
  model: openai('gpt-5-mini'),
  prompt: 'Scrape https://firecrawl.dev and https://docs.firecrawl.dev, then compare',
  tools: { batchScrape: batchScrapeTool, poll: pollTool },
});

console.log(text);
```

### Extract

Async operation - include `pollTool` to check job status.

```typescript  theme={null}
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { extractTool, pollTool } from 'firecrawl-aisdk';

const { text } = await generateText({
  model: openai('gpt-5-mini'),
  prompt: 'Extract the main features from https://firecrawl.dev',
  tools: { extract: extractTool, poll: pollTool },
});

console.log(text);
```

### Search + Scrape

```typescript  theme={null}
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { searchTool, scrapeTool } from 'firecrawl-aisdk';

const { text } = await generateText({
  model: openai('gpt-5-mini'),
  prompt: 'Search for Firecrawl, scrape the top result, and explain what it does',
  tools: { search: searchTool, scrape: scrapeTool },
});

console.log(text);
```

### Stream

```typescript  theme={null}
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { scrapeTool } from 'firecrawl-aisdk';

const result = streamText({
  model: openai('gpt-5-mini'),
  prompt: 'Scrape https://firecrawl.dev and explain what it does',
  tools: { scrape: scrapeTool },
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt

# Building an AI Research Assistant with Firecrawl and AI SDK

> Build a complete AI-powered research assistant with web scraping and search capabilities

Build a complete AI-powered research assistant that can scrape websites and search the web to answer questions. The assistant automatically decides when to use web scraping or search tools to gather information, then provides comprehensive answers based on collected data.

<img src="https://mintcdn.com/firecrawl/GKat0bF5SiRAHSEa/images/guides/cookbooks/ai-sdk-cookbook/firecrawl-ai-sdk-chatbot.gif?s=cfcbad69aa3f087a474414c0763a260b" alt="AI research assistant chatbot interface showing real-time web scraping with Firecrawl and conversational responses powered by OpenAI" data-og-width="1044" width="1044" data-og-height="716" height="716" data-path="images/guides/cookbooks/ai-sdk-cookbook/firecrawl-ai-sdk-chatbot.gif" data-optimize="true" data-opv="3" />

## What You'll Build

An AI chat interface where users can ask questions about any topic. The AI assistant automatically decides when to use web scraping or search tools to gather information, then provides comprehensive answers based on the data it collects.

## Prerequisites

* Node.js 18 or later installed
* An OpenAI API key from [platform.openai.com](https://platform.openai.com)
* A Firecrawl API key from [firecrawl.dev](https://firecrawl.dev)
* Basic knowledge of React and Next.js

<Steps>
  <Step title="Create a New Next.js Project">
    Start by creating a fresh Next.js application and navigating into the project directory:

    ```bash  theme={null}
    npx create-next-app@latest ai-sdk-firecrawl && cd ai-sdk-firecrawl
    ```

    When prompted, select the following options:

    * TypeScript: Yes
    * ESLint: Yes
    * Tailwind CSS: Yes
    * App Router: Yes
    * Use `src/` directory: No
    * Import alias: Yes (@/\*)
  </Step>

  <Step title="Install Dependencies">
    ### Install AI SDK Packages

    The AI SDK is a TypeScript toolkit that provides a unified API for working with different LLM providers:

    ```bash  theme={null}
    npm i ai @ai-sdk/react zod
    ```

    These packages provide:

    * `ai`: Core SDK with streaming, tool calling, and response handling
    * `@ai-sdk/react`: React hooks like `useChat` for building chat interfaces
    * `zod`: Schema validation for tool inputs

    Learn more at [ai-sdk.dev/docs](https://ai-sdk.dev/docs).

    ### Install AI Elements

    AI Elements provides pre-built UI components for AI applications. Run the following command to scaffold all the necessary components:

    ```bash  theme={null}
    npx ai-elements@latest
    ```

    This sets up AI Elements in your project, including conversation components, message displays, prompt inputs, and tool call visualizations.

    Documentation: [ai-sdk.dev/elements/overview](https://ai-sdk.dev/elements/overview).

    ### Install OpenAI Provider

    Install the OpenAI provider to connect with OpenAI's models:

    ```bash  theme={null}
    npm install @ai-sdk/openai
    ```
  </Step>

  <Step title="Build the Frontend Chat Interface">
    Create the main page at `app/page.tsx` and copy the code from the Code tab below. This will be the chat interface where users interact with the AI assistant.

    <Tabs>
      <Tab title="Preview">
                <img src="https://mintcdn.com/firecrawl/GKat0bF5SiRAHSEa/images/guides/cookbooks/ai-sdk-cookbook/firecrawl-ai-sdk-chatbot.gif?s=cfcbad69aa3f087a474414c0763a260b" alt="AI research assistant chatbot interface showing real-time web scraping with Firecrawl and conversational responses powered by OpenAI" data-og-width="1044" width="1044" data-og-height="716" height="716" data-path="images/guides/cookbooks/ai-sdk-cookbook/firecrawl-ai-sdk-chatbot.gif" data-optimize="true" data-opv="3" />
      </Tab>

      <Tab title="Code">
        ```typescript app/page.tsx theme={null}
        "use client";

        import {
          Conversation,
          ConversationContent,
          ConversationScrollButton,
        } from "@/components/ai-elements/conversation";
        import {
          PromptInput,
          PromptInputActionAddAttachments,
          PromptInputActionMenu,
          PromptInputActionMenuContent,
          PromptInputActionMenuTrigger,
          PromptInputAttachment,
          PromptInputAttachments,
          PromptInputBody,
          PromptInputButton,
          PromptInputHeader,
          type PromptInputMessage,
          PromptInputSelect,
          PromptInputSelectContent,
          PromptInputSelectItem,
          PromptInputSelectTrigger,
          PromptInputSelectValue,
          PromptInputSubmit,
          PromptInputTextarea,
          PromptInputFooter,
          PromptInputTools,
        } from "@/components/ai-elements/prompt-input";
        import {
          MessageResponse,
          Message,
          MessageContent,
          MessageActions,
          MessageAction,
        } from "@/components/ai-elements/message";

        import { Fragment, useState } from "react";
        import { useChat } from "@ai-sdk/react";
        import type { ToolUIPart } from "ai";
        import {
          Tool,
          ToolContent,
          ToolHeader,
          ToolInput,
          ToolOutput,
        } from "@/components/ai-elements/tool";

        import { CopyIcon, GlobeIcon, RefreshCcwIcon } from "lucide-react";
        import {
          Source,
          Sources,
          SourcesContent,
          SourcesTrigger,
        } from "@/components/ai-elements/sources";
        import {
          Reasoning,
          ReasoningContent,
          ReasoningTrigger,
        } from "@/components/ai-elements/reasoning";
        import { Loader } from "@/components/ai-elements/loader";

        const models = [
          {
            name: "GPT 5 Mini (Thinking)",
            value: "gpt-5-mini",
          },
          {
            name: "GPT 4o Mini",
            value: "gpt-4o-mini",
          },
        ];

        const ChatBotDemo = () => {
          const [input, setInput] = useState("");
          const [model, setModel] = useState<string>(models[0].value);
          const [webSearch, setWebSearch] = useState(false);
          const { messages, sendMessage, status, regenerate } = useChat();

          const handleSubmit = (message: PromptInputMessage) => {
            const hasText = Boolean(message.text);
            const hasAttachments = Boolean(message.files?.length);

            if (!(hasText || hasAttachments)) {
              return;
            }

            sendMessage(
              {
                text: message.text || "Sent with attachments",
                files: message.files,
              },
              {
                body: {
                  model: model,
                  webSearch: webSearch,
                },
              }
            );
            setInput("");
          };

          return (
            <div className="max-w-4xl mx-auto p-6 relative size-full h-screen">
              <div className="flex flex-col h-full">
                <Conversation className="h-full">
                  <ConversationContent>
                    {messages.map((message) => (
                      <div key={message.id}>
                        {message.role === "assistant" &&
                          message.parts.filter((part) => part.type === "source-url")
                            .length > 0 && (
                            <Sources>
                              <SourcesTrigger
                                count={
                                  message.parts.filter(
                                    (part) => part.type === "source-url"
                                  ).length
                                }
                              />
                              {message.parts
                                .filter((part) => part.type === "source-url")
                                .map((part, i) => (
                                  <SourcesContent key={`${message.id}-${i}`}>
                                    <Source
                                      key={`${message.id}-${i}`}
                                      href={part.url}
                                      title={part.url}
                                    />
                                  </SourcesContent>
                                ))}
                            </Sources>
                          )}
                        {message.parts.map((part, i) => {
                          switch (part.type) {
                            case "text":
                              return (
                                <Fragment key={`${message.id}-${i}`}>
                                  <Message from={message.role}>
                                    <MessageContent>
                                      <MessageResponse>{part.text}</MessageResponse>
                                    </MessageContent>
                                  </Message>
                                  {message.role === "assistant" &&
                                    i === messages.length - 1 && (
                                      <MessageActions className="mt-2">
                                        <MessageAction
                                          onClick={() => regenerate()}
                                          label="Retry"
                                        >
                                          <RefreshCcwIcon className="size-3" />
                                        </MessageAction>
                                        <MessageAction
                                          onClick={() =>
                                            navigator.clipboard.writeText(part.text)
                                          }
                                          label="Copy"
                                        >
                                          <CopyIcon className="size-3" />
                                        </MessageAction>
                                      </MessageActions>
                                    )}
                                </Fragment>
                              );
                            case "reasoning":
                              return (
                                <Reasoning
                                  key={`${message.id}-${i}`}
                                  className="w-full"
                                  isStreaming={
                                    status === "streaming" &&
                                    i === message.parts.length - 1 &&
                                    message.id === messages.at(-1)?.id
                                  }
                                >
                                  <ReasoningTrigger />
                                  <ReasoningContent>{part.text}</ReasoningContent>
                                </Reasoning>
                              );
                            default: {
                              if (part.type.startsWith("tool-")) {
                                const toolPart = part as ToolUIPart;
                                return (
                                  <Tool
                                    key={`${message.id}-${i}`}
                                    defaultOpen={toolPart.state === "output-available"}
                                  >
                                    <ToolHeader
                                      type={toolPart.type}
                                      state={toolPart.state}
                                    />
                                    <ToolContent>
                                      <ToolInput input={toolPart.input} />
                                      <ToolOutput
                                        output={toolPart.output}
                                        errorText={toolPart.errorText}
                                      />
                                    </ToolContent>
                                  </Tool>
                                );
                              }
                              return null;
                            }
                          }
                        })}
                      </div>
                    ))}
                    {status === "submitted" && <Loader />}
                  </ConversationContent>
                  <ConversationScrollButton />
                </Conversation>

                <PromptInput
                  onSubmit={handleSubmit}
                  className="mt-4"
                  globalDrop
                  multiple
                >
                  <PromptInputHeader>
                    <PromptInputAttachments>
                      {(attachment) => <PromptInputAttachment data={attachment} />}
                    </PromptInputAttachments>
                  </PromptInputHeader>
                  <PromptInputBody>
                    <PromptInputTextarea
                      onChange={(e) => setInput(e.target.value)}
                      value={input}
                    />
                  </PromptInputBody>
                  <PromptInputFooter>
                    <PromptInputTools>
                      <PromptInputActionMenu>
                        <PromptInputActionMenuTrigger />
                        <PromptInputActionMenuContent>
                          <PromptInputActionAddAttachments />
                        </PromptInputActionMenuContent>
                      </PromptInputActionMenu>
                      <PromptInputButton
                        variant={webSearch ? "default" : "ghost"}
                        onClick={() => setWebSearch(!webSearch)}
                      >
                        <GlobeIcon size={16} />
                        <span>Search</span>
                      </PromptInputButton>
                      <PromptInputSelect
                        onValueChange={(value) => {
                          setModel(value);
                        }}
                        value={model}
                      >
                        <PromptInputSelectTrigger>
                          <PromptInputSelectValue />
                        </PromptInputSelectTrigger>
                        <PromptInputSelectContent>
                          {models.map((model) => (
                            <PromptInputSelectItem
                              key={model.value}
                              value={model.value}
                            >
                              {model.name}
                            </PromptInputSelectItem>
                          ))}
                        </PromptInputSelectContent>
                      </PromptInputSelect>
                    </PromptInputTools>
                    <PromptInputSubmit disabled={!input && !status} status={status} />
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </div>
          );
        };

        export default ChatBotDemo;
        ```
      </Tab>
    </Tabs>

    ### Understanding the Frontend

    The frontend uses AI Elements components to provide a complete chat interface:

    **Key Features:**

    * **Conversation Display**: The `Conversation` component automatically handles message scrolling and display
    * **Message Rendering**: Each message part is rendered based on its type (text, reasoning, tool calls)
    * **Tool Visualization**: Tool calls are displayed with collapsible sections showing inputs and outputs
    * **Interactive Controls**: Users can toggle web search, select models, and attach files
    * **Message Actions**: Copy and retry actions for assistant messages
  </Step>

  <Step title="Add Markdown Rendering Support">
    To ensure the markdown from the LLM is correctly rendered, add the following import to your `app/globals.css` file:

    ```css  theme={null}
    @source "../node_modules/streamdown/dist/index.js";
    ```

    This imports the necessary styles for rendering markdown content in the message responses.
  </Step>

  <Step title="Build the Basic API Route">
    Create the chat API endpoint at `app/api/chat/route.ts`. This route will handle incoming messages and stream responses from the AI.

    ```typescript  theme={null}
    import { streamText, UIMessage, convertToModelMessages } from "ai";
    import { createOpenAI } from "@ai-sdk/openai";

    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    // Allow streaming responses up to 5 minutes
    export const maxDuration = 300;

    export async function POST(req: Request) {
      const {
        messages,
        model,
        webSearch,
      }: {
        messages: UIMessage[];
        model: string;
        webSearch: boolean;
      } = await req.json();

      const result = streamText({
        model: openai(model),
        messages: convertToModelMessages(messages),
        system:
          "You are a helpful assistant that can answer questions and help with tasks.",
      });

      // send sources and reasoning back to the client
      return result.toUIMessageStreamResponse({
        sendSources: true,
        sendReasoning: true,
      });
    }
    ```

    This basic route:

    * Receives messages from the frontend
    * Uses the OpenAI model selected by the user
    * Streams responses back to the client
    * Doesn't include tools yet - we'll add those next
  </Step>

  <Step title="Configure Environment Variables">
    Create a `.env.local` file in your project root:

    ```bash  theme={null}
    touch .env.local
    ```

    Add your OpenAI API key:

    ```env  theme={null}
    OPENAI_API_KEY=sk-your-openai-api-key
    ```

    The `OPENAI_API_KEY` is required for the AI model to function.
  </Step>

  <Step title="Test the Basic Chat">
    Now you can test the AI SDK chatbot without Firecrawl integration. Start the development server:

    ```bash  theme={null}
    npm run dev
    ```

    Open [localhost:3000](http://localhost:3000) in your browser and test the basic chat functionality. The assistant should respond to messages, but won't have web scraping or search capabilities yet.

        <img src="https://mintcdn.com/firecrawl/GKat0bF5SiRAHSEa/images/guides/cookbooks/ai-sdk-cookbook/simple-ai-sdk-chatbot.gif?s=dd40938ec93fd0ad13568d2825d7552d" alt="Basic AI chatbot without web scraping capabilities" data-og-width="1192" width="1192" data-og-height="720" height="720" data-path="images/guides/cookbooks/ai-sdk-cookbook/simple-ai-sdk-chatbot.gif" data-optimize="true" data-opv="3" />
  </Step>

  <Step title="Add Firecrawl Tools">
    Now let's enhance the assistant with web scraping and search capabilities using Firecrawl.

    ### Install Firecrawl SDK

    Firecrawl converts websites into LLM-ready formats with scraping and search capabilities:

    ```bash  theme={null}
    npm i @mendable/firecrawl-js
    ```

    ### Create the Tools File

    Create a `lib` folder and add a `tools.ts` file inside it:

    ```bash  theme={null}
    mkdir lib && touch lib/tools.ts
    ```

    Add the following code to define the web scraping and search tools:

    ```typescript lib/tools.ts theme={null}
    import FirecrawlApp from "@mendable/firecrawl-js";
    import { tool } from "ai";
    import { z } from "zod";

    const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

    export const scrapeWebsiteTool = tool({
      description: 'Scrape content from any website URL',
      inputSchema: z.object({
        url: z.string().url().describe('The URL to scrape')
      }),
      execute: async ({ url }) => {
        console.log('Scraping:', url);
        const result = await firecrawl.scrape(url, {
          formats: ['markdown'],
          onlyMainContent: true,
          timeout: 30000
        });
        console.log('Scraped content preview:', result.markdown?.slice(0, 200) + '...');
        return { content: result.markdown };
      }
    });

    export const searchWebTool = tool({
      description: 'Search the web using Firecrawl',
      inputSchema: z.object({
        query: z.string().describe('The search query'),
        limit: z.number().optional().describe('Number of results'),
        location: z.string().optional().describe('Location for localized results'),
        tbs: z.string().optional().describe('Time filter (qdr:h, qdr:d, qdr:w, qdr:m, qdr:y)'),
        sources: z.array(z.enum(['web', 'news', 'images'])).optional().describe('Result types'),
        categories: z.array(z.enum(['github', 'research', 'pdf'])).optional().describe('Filter categories'),
      }),
      execute: async ({ query, limit, location, tbs, sources, categories }) => {
        console.log('Searching:', query);
        const response = await firecrawl.search(query, {
          ...(limit && { limit }),
          ...(location && { location }),
          ...(tbs && { tbs }),
          ...(sources && { sources }),
          ...(categories && { categories }),
        }) as { web?: Array<{ title?: string; url?: string; description?: string }> };

        const results = (response.web || []).map((item) => ({
          title: item.title || item.url || 'Untitled',
          url: item.url || '',
          description: item.description || '',
        }));

        console.log('Search results:', results.length);
        return { results };
      },
    });
    ```

    ### Understanding the Tools

    **Scrape Website Tool:**

    * Accepts a URL as input (validated by Zod schema)
    * Uses Firecrawl's `scrape` method to fetch the page as markdown
    * Extracts only the main content to reduce token usage
    * Returns the scraped content for the AI to analyze

    **Search Web Tool:**

    * Accepts a search query with optional filters
    * Uses Firecrawl's `search` method to find relevant web pages
    * Supports advanced filters like location, time range, and content categories
    * Returns structured results with titles, URLs, and descriptions

    Learn more about tools: [ai-sdk.dev/docs/foundations/tools](https://ai-sdk.dev/docs/foundations/tools).
  </Step>

  <Step title="Update the API Route with Firecrawl Tools">
    Now update your `app/api/chat/route.ts` to include the Firecrawl tools we just created.

    <Accordion title="View complete app/api/chat/route.ts code">
      ```typescript  theme={null}
      import { streamText, UIMessage, stepCountIs, convertToModelMessages } from "ai";
      import { createOpenAI } from "@ai-sdk/openai";
      import { scrapeWebsiteTool, searchWebTool } from "@/lib/tools";

      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY!,
      });

      export const maxDuration = 300;

      export async function POST(req: Request) {
        const {
          messages,
          model,
          webSearch,
        }: {
          messages: UIMessage[];
          model: string;
          webSearch: boolean;
        } = await req.json();

        const result = streamText({
          model: openai(model),
          messages: convertToModelMessages(messages),
          system:
            "You are a helpful assistant that can answer questions and help with tasks.",
          // Add the Firecrawl tools here
          tools: {
            scrapeWebsite: scrapeWebsiteTool,
            searchWeb: searchWebTool,
          },
          stopWhen: stepCountIs(5),
          toolChoice: webSearch ? "auto" : "none",
        });

        return result.toUIMessageStreamResponse({
          sendSources: true,
          sendReasoning: true,
        });
      }
      ```
    </Accordion>

    The key changes from the basic route:

    * Import `stepCountIs` from the AI SDK
    * Import the Firecrawl tools from `@/lib/tools`
    * Add the `tools` object with both `scrapeWebsite` and `searchWeb` tools
    * Add `stopWhen: stepCountIs(5)` to limit execution steps
    * Set `toolChoice` to "auto" when web search is enabled, "none" otherwise

    Learn more about `streamText`: [ai-sdk.dev/docs/reference/ai-sdk-core/stream-text](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text).
  </Step>

  <Step title="Add Your Firecrawl API Key">
    Update your `.env.local` file to include your Firecrawl API key:

    ```env  theme={null}
    OPENAI_API_KEY=sk-your-openai-api-key
    FIRECRAWL_API_KEY=fc-your-firecrawl-api-key
    ```

    Get your Firecrawl API key from [firecrawl.dev](https://firecrawl.dev).
  </Step>

  <Step title="Test the Complete Application">
    Restart your development server:

    ```bash  theme={null}
    npm run dev
    ```

        <img src="https://mintcdn.com/firecrawl/GKat0bF5SiRAHSEa/images/guides/cookbooks/ai-sdk-cookbook/active-firecrawl-tools-ai-sdk.gif?s=015de571c2352a0cf6eb70ddb2eaec64" alt="AI chatbot with active Firecrawl tools" data-og-width="1084" width="1084" data-og-height="720" height="720" data-path="images/guides/cookbooks/ai-sdk-cookbook/active-firecrawl-tools-ai-sdk.gif" data-optimize="true" data-opv="3" />

    Open [localhost:3000](http://localhost:3000) and test the enhanced assistant:

    1. Toggle the "Search" button to enable web search
    2. Ask: "What are the latest features from firecrawl.dev?"
    3. Watch as the AI calls the `searchWeb` or `scrapeWebsite` tool
    4. See the tool execution in the UI with inputs and outputs
    5. Read the AI's analysis based on the scraped data
  </Step>
</Steps>

## How It Works

### Message Flow

1. **User sends a message**: The user types a question and clicks submit
2. **Frontend sends request**: `useChat` sends the message to `/api/chat` with the selected model and web search setting
3. **Backend processes message**: The API route receives the message and calls `streamText`
4. **AI decides on tools**: The model analyzes the question and decides whether to use `scrapeWebsite` or `searchWeb` (only if web search is enabled)
5. **Tools execute**: If tools are called, Firecrawl scrapes or searches the web
6. **AI generates response**: The model analyzes tool results and generates a natural language response
7. **Frontend displays results**: The UI shows tool calls and the final response in real-time

### Tool Calling Process

The AI SDK's tool calling system ([ai-sdk.dev/docs/foundations/tools](https://ai-sdk.dev/docs/foundations/tools)) works as follows:

1. The model receives the user's message and available tool descriptions
2. If the model determines a tool is needed, it generates a tool call with parameters
3. The SDK executes the tool function with those parameters
4. The tool result is sent back to the model
5. The model uses the result to generate its final response

This all happens automatically within a single `streamText` call, with results streaming to the frontend in real-time.

## Key Features

### Model Selection

The application supports multiple OpenAI models:

* **GPT-5 Mini (Thinking)**: Recent OpenAI model with advanced reasoning capabilities
* **GPT-4o Mini**: Fast and cost-effective model

Users can switch between models using the dropdown selector.

### Web Search Toggle

The Search button controls whether the AI can use Firecrawl tools:

* **Enabled**: AI can call `scrapeWebsite` and `searchWeb` tools as needed
* **Disabled**: AI responds only with its training knowledge

This gives users control over when to use web data versus the model's built-in knowledge.

## Customization Ideas

### Add More Tools

Extend the assistant with additional tools:

* Database lookups for internal company data
* CRM integration to fetch customer information
* Email sending capabilities
* Document generation

Each tool follows the same pattern: define a schema with Zod, implement the execute function, and register it in the `tools` object.

### Change the AI Model

Swap OpenAI for another provider:

```typescript  theme={null}
import { anthropic } from "@ai-sdk/anthropic";

const result = streamText({
  model: anthropic("claude-4.5-sonnet"),
  // ... rest of config
});
```

The AI SDK supports 20+ providers with the same API. Learn more: [ai-sdk.dev/docs/foundations/providers-and-models](https://ai-sdk.dev/docs/foundations/providers-and-models).

### Customize the UI

AI Elements components are built on shadcn/ui, so you can:

* Modify component styles in the component files
* Add new variants to existing components
* Create custom components that match the design system

## Best Practices

1. **Use appropriate tools**: Choose `searchWeb` to find relevant pages first, `scrapeWebsite` for single pages, or let the AI decide

2. **Monitor API usage**: Track your Firecrawl and OpenAI API usage to avoid unexpected costs

3. **Handle errors gracefully**: The tools include error handling, but consider adding user-facing error messages

4. **Optimize performance**: Use streaming to provide immediate feedback and consider caching frequently accessed content

5. **Set reasonable limits**: The `stopWhen: stepCountIs(5)` prevents excessive tool calls and runaway costs

***

## Related Resources

<CardGroup cols={2}>
  <Card title="AI SDK Documentation" href="https://ai-sdk.dev/docs">
    Explore the AI SDK for building AI-powered applications with streaming, tool
    calling, and multi-provider support.
  </Card>

  <Card title="AI Elements Components" href="https://ai-sdk.dev/elements/overview">
    Pre-built UI components for AI applications built on shadcn/ui.
  </Card>
</CardGroup>


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt

# Authenticated Scraping

> Learn how to scrape content behind authentication using cookies

<Warning>
  **Important:** Only use authenticated scraping on systems where you have explicit permission from both parties (yourself and the platform owner), such as internal, self-hosted tools or resources you fully control. Do not use authentication on platforms unless you are certain it abides by the site's Terms and Conditions and get written permission when in doubt. Using session cookies improperly can violate terms of service or laws; always confirm you are authorized to access protected content in this way.
</Warning>

## Overview

The recommended approach for authenticated scraping is **cookie-based authentication**, where you:

1. Login manually to your application
2. Extract the session cookie from DevTools
3. Use the cookie with Firecrawl to access protected pages

<Note>
  **Cookie Expiration Times:**

  * **Internal tools**: Often 7-30 days or longer
  * **Other tools**: Often hours or minutes

  Internal tools typically have longer cookie lifespans, making this method ideal for recurring scraping tasks.
</Note>

***

## Setup

<Steps>
  <Step title="Get API Key">
    Get your Firecrawl API key from [firecrawl.dev/app](https://firecrawl.dev/app)
  </Step>

  <Step title="Install Dependencies">
    ```bash npm theme={null}
    npm install @mendable/firecrawl-js
    ```

    <Note>
      **Node.js \< v20**: If you're using Node.js version 19 or earlier, you'll also need to install `dotenv`:

      ```bash  theme={null}
      npm install dotenv
      ```

      And import it with `import 'dotenv/config'` at the top of your file.
    </Note>
  </Step>

  <Step title="Configure Environment">
    Create a `.env` file:

    ```bash .env theme={null}
    FIRECRAWL_API_KEY=your_firecrawl_api_key
    ```
  </Step>
</Steps>

***

## Method 1: Cookie-Based Authentication

### Step 1: Extract Cookies from DevTools

<Note>
  **Demo Application**: You can practice with our demo app at [https://firecrawl-auth.vercel.app](https://firecrawl-auth.vercel.app)

  * Email: `test@example.com`
  * Password: `password123`
</Note>

<Steps>
  <Step title="Login to Your Application">
    Navigate to [https://firecrawl-auth.vercel.app](https://firecrawl-auth.vercel.app) and login with the credentials above
  </Step>

  <Step title="Open DevTools">
    Press `F12` or right-click → "Inspect"
  </Step>

  <Step title="Navigate to Application Tab">
    Click the **Application** tab (Chrome) or **Storage** tab (Firefox)
  </Step>

  <Step title="Find and Copy Cookie">
    1. Expand **Cookies** in the sidebar
    2. Click on your domain
    3. Find the `auth-token` cookie
    4. Double-click the **Value** and copy it

    <img src="https://mintcdn.com/firecrawl/NR4iESBjjsDFYTef/images/guides/dev-tools-cookie.png?fit=max&auto=format&n=NR4iESBjjsDFYTef&q=85&s=8dea208fd9512430bce8f1063706b49c" alt="DevTools Cookies View" data-og-width="1992" width="1992" data-og-height="1226" height="1226" data-path="images/guides/dev-tools-cookie.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/firecrawl/NR4iESBjjsDFYTef/images/guides/dev-tools-cookie.png?w=280&fit=max&auto=format&n=NR4iESBjjsDFYTef&q=85&s=7deb61ef88a1db102c4846ce75c2a68e 280w, https://mintcdn.com/firecrawl/NR4iESBjjsDFYTef/images/guides/dev-tools-cookie.png?w=560&fit=max&auto=format&n=NR4iESBjjsDFYTef&q=85&s=5d4ff7787fef1281daf2d33e7f994acb 560w, https://mintcdn.com/firecrawl/NR4iESBjjsDFYTef/images/guides/dev-tools-cookie.png?w=840&fit=max&auto=format&n=NR4iESBjjsDFYTef&q=85&s=190086435afa1689a222a5a60c088a22 840w, https://mintcdn.com/firecrawl/NR4iESBjjsDFYTef/images/guides/dev-tools-cookie.png?w=1100&fit=max&auto=format&n=NR4iESBjjsDFYTef&q=85&s=c716c9ebd526302c35ed2337a25ddcbb 1100w, https://mintcdn.com/firecrawl/NR4iESBjjsDFYTef/images/guides/dev-tools-cookie.png?w=1650&fit=max&auto=format&n=NR4iESBjjsDFYTef&q=85&s=6b13bbbbace05a5f2e31640949d63899 1650w, https://mintcdn.com/firecrawl/NR4iESBjjsDFYTef/images/guides/dev-tools-cookie.png?w=2500&fit=max&auto=format&n=NR4iESBjjsDFYTef&q=85&s=316b0b9e399cc8d86f228856ebd1d90a 2500w" />
  </Step>
</Steps>

For the demo app, the cookie looks like:

```
auth-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJleGFtcGxlLXVzZXItaWQiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.example-signature-hash
```

<Warning>
  **Important:** Cookies are sensitive credentials. Never share them publicly or commit them to version control. Treat them like passwords.
</Warning>

### Step 2: Use Cookies with Firecrawl

```typescript  theme={null}
import FirecrawlApp from "@mendable/firecrawl-js";

const app = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY
});

const result = await app.scrape("https://firecrawl-auth.vercel.app/dashboard", {
  formats: ["markdown", "screenshot"],
  headers: {
    Cookie: 'auth-token=COOKIE_GOES_HERE'
  },
  waitFor: 3000, // Wait 3 extra seconds for the page to load
});

console.log("=== Markdown ===\n" + result.markdown + "\n\n=== Screenshot URL ===\n" + result.screenshot);
```

## Best Practices

<CardGroup cols={2}>
  <Card title="Cookie Security" icon="lock">
    * Store cookies in environment variables
    * Never commit cookies to git
    * Rotate cookies regularly
    * Use `.gitignore` for `.env` files
  </Card>

  <Card title="Cookie Expiration" icon="clock">
    * Check expiration times in DevTools
    * Set up alerts before expiration
    * Re-extract cookies when they expire
    * Consider using form-based auth for short-lived cookies
  </Card>

  <Card title="Rate Limiting" icon="gauge">
    * Respect the application's rate limits
    * Add delays between requests
    * Monitor for 429 (Too Many Requests) errors
    * Use exponential backoff for retries
  </Card>

  <Card title="Error Handling" icon="shield">
    * Check for 401/403 errors (expired cookies)
    * Validate response content
    * Log authentication failures
    * Have fallback authentication methods
  </Card>
</CardGroup>

***

## Troubleshooting

<AccordionGroup>
  <Accordion title="Getting 401 Unauthorized Errors" icon="ban">
    **Possible causes:**

    * Cookie has expired
    * Cookie was copied incorrectly
    * Application requires additional headers
    * Session was invalidated on the server

    **Solutions:**

    * Re-extract cookies from DevTools after a fresh login
    * Check if you need multiple cookies (session + CSRF token)
    * Verify the cookie domain matches your target URL
  </Accordion>

  <Accordion title="Cookie Not Working" icon="cookie-bite">
    **Check these:**

    * Is the cookie name correct?
    * Did you copy the entire cookie value?
    * Does the cookie have the correct domain?
    * Is there a `Path` restriction on the cookie?
    * Are there multiple cookies required?

    **Pro tip:** Copy all cookies from DevTools and test with all of them, then remove one by one to find which are required.
  </Accordion>

  <Accordion title="Session Expires Too Quickly" icon="hourglass">
    **For short-lived sessions:**

    * Use form-based authentication instead
    * Automate the login process with actions
    * Set up a cron job to refresh cookies
    * Consider requesting longer session times from your internal tool's admin
  </Accordion>
</AccordionGroup>

<Note>
  **Cookie Lifespan for Internal Tools:** Many internal tools set cookies with 7-30 day expiration times, making them ideal for recurring scraping tasks. Check your cookie's `Expires` field in DevTools to see how long it's valid.
</Note>


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt

# Product & E-commerce

> Monitor pricing and track inventory across e-commerce sites

E-commerce teams use Firecrawl to monitor pricing, track inventory, and migrate product catalogs between platforms.

## Start with a Template

<Card title="Firecrawl Migrator" icon="github" href="https://github.com/mendableai/firecrawl-migrator">
  Migrate product catalogs and e-commerce data between platforms
</Card>

<Note>
  **Get started with the Firecrawl Migrator template.** Extract and migrate e-commerce data efficiently.
</Note>

## How It Works

Transform e-commerce websites into structured product data. Monitor competitor pricing in real-time, track inventory levels across suppliers, and seamlessly migrate product catalogs between platforms.

## What You Can Extract

* **Product Data**: Title, SKU, specs, descriptions, categories
* **Pricing**: Current price, discounts, shipping, tax
* **Inventory**: Stock levels, availability, lead times
* **Reviews**: Ratings, customer feedback, Q\&A sections

## Use Cases in Action

<CardGroup cols={2}>
  <Card>
    **Price Monitoring**

    Track competitor pricing across multiple e-commerce sites, receive alerts on price changes, and optimize your pricing strategy based on real-time market data.
  </Card>

  <Card>
    **Catalog Migration**

    Seamlessly migrate thousands of products between e-commerce platforms, preserving all product data, variants, images, and metadata.
  </Card>
</CardGroup>

## FAQs

<AccordionGroup>
  <Accordion title="How can I track competitor pricing changes?">
    Build a monitoring system using Firecrawl's API to extract prices at regular intervals. Compare extracted data over time to identify pricing trends, promotions, and competitive positioning.
  </Accordion>

  <Accordion title="Can I extract product variants (size, color, etc.)?">
    Yes, Firecrawl can extract all product variants including size, color, and other options. Structure the data with custom schemas to capture all variant information.
  </Accordion>

  <Accordion title="How do I handle dynamic pricing or user-specific prices?">
    For dynamic pricing, you can use Firecrawl's JavaScript rendering to capture prices after they load. For user-specific pricing, configure authentication headers in your requests.
  </Accordion>

  <Accordion title="Can I extract data from different e-commerce platforms?">
    Yes. Firecrawl can extract data from any publicly accessible e-commerce website. Users successfully extract from Shopify, WooCommerce, Magento, BigCommerce, and custom-built stores.
  </Accordion>

  <Accordion title="Can Firecrawl handle pagination and infinite scroll?">
    Yes. Firecrawl can navigate through paginated product listings and handle infinite scroll mechanisms to extract complete product catalogs, ensuring no products are missed during extraction.
  </Accordion>
</AccordionGroup>

## Related Use Cases

* [Lead Enrichment](/use-cases/lead-enrichment) - Enrich B2B e-commerce leads
* [Competitive Intelligence](/use-cases/competitive-intelligence) - Track competitor strategies
* [Data Migration](/use-cases/data-migration) - Migrate between platforms


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt

# Open Source vs Cloud

> Understand the differences between Firecrawl's open-source and cloud offerings

Firecrawl is open source available under the [AGPL-3.0 license](https://github.com/mendableai/firecrawl/blob/main/LICENSE).

To deliver the best possible product, we offer a hosted version of Firecrawl alongside our open-source offering. The cloud solution allows us to continuously innovate and maintain a high-quality, sustainable service for all users.

Firecrawl Cloud is available at [firecrawl.dev](https://firecrawl.dev) and offers a range of features that are not available in the open source version:

<img src="https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/open-source-cloud.png?fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=763a6e92c8605d06294ed7ed45df85d0" alt="Firecrawl Cloud vs Open Source" data-og-width="2808" width="2808" data-og-height="856" height="856" data-path="images/open-source-cloud.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/open-source-cloud.png?w=280&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=2e9112d82aec51ca204ceee026b6bad3 280w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/open-source-cloud.png?w=560&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=9fabc257f1caa297b1b8ec68fb13eddc 560w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/open-source-cloud.png?w=840&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=e766290156ea4226df484ee815f5036f 840w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/open-source-cloud.png?w=1100&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=ed02646081bce28427156ba1d8bf4fa2 1100w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/open-source-cloud.png?w=1650&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=41d72e1c116d48ebc0cfa1a3499b3e9e 1650w, https://mintcdn.com/firecrawl/vlKm1oZYK3oSRVTM/images/open-source-cloud.png?w=2500&fit=max&auto=format&n=vlKm1oZYK3oSRVTM&q=85&s=0f6f34e97633cabdc17cbc28d7af2bb9 2500w" />


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt
# AI Platforms

> Power AI assistants and let customers build AI apps

AI platform builders and teams use Firecrawl to power knowledge bases, chatbots, and enable customers to build AI applications with web data.

## Start with a Template

<Card title="Firestarter" icon="github" href="https://github.com/mendableai/firestarter">
  Instant AI chatbots for websites with web knowledge integration
</Card>

<Note>
  **Get started with templates and examples.** Build AI-powered applications with web data.
</Note>

## How It Works

Transform websites into AI-ready data. Power chatbots with real-time web knowledge, build RAG systems with up-to-date documentation, and enable your users to connect their AI applications to web sources.

## Why AI Platforms Choose Firecrawl

### Reduce Hallucinations with Real-Time Data

Your AI assistants need current information, not outdated training data. Whether it's domain-specific knowledge, technical documentation, or industry-specific content, Firecrawl ensures your knowledge bases stay synchronized with the latest updates-reducing hallucinations and improving response accuracy.

## Customer Stories

<CardGroup cols={2}>
  <Card href="https://www.firecrawl.dev/blog/how-replit-uses-firecrawl-to-power-ai-agents">
    **Replit**

    Learn how Replit leverages Firecrawl to keep Replit Agent up-to-date with the latest API documentation and web content.
  </Card>

  <Card href="https://www.firecrawl.dev/blog/how-stack-ai-uses-firecrawl-to-power-ai-agents">
    **Stack AI**

    Discover how Stack AI uses Firecrawl to seamlessly feed agentic AI workflows with high-quality web data.
  </Card>
</CardGroup>

## FAQs

<AccordionGroup>
  <Accordion title="How does Firecrawl integrate with AI development platforms?">
    Firecrawl provides simple APIs and SDKs that integrate directly into AI platforms. Whether you're building with LangChain, using no-code tools like n8n, or custom frameworks, Firecrawl delivers clean, structured web data ready for AI consumption.
  </Accordion>

  <Accordion title="Can Firecrawl handle the scale required for AI training?">
    Yes. Firecrawl is designed for enterprise-scale data extraction, processing millions of pages for AI training datasets. Our infrastructure scales automatically to meet your needs.
  </Accordion>

  <Accordion title="What data formats does Firecrawl provide for AI platforms?">
    Firecrawl delivers data in AI-friendly formats including clean markdown, structured JSON, raw HTML, extracted images, screenshots, and news content. This flexibility ensures compatibility with any AI platform's data ingestion requirements.
  </Accordion>

  <Accordion title="How do I handle authentication for gated content?">
    Firecrawl supports authentication headers and cookies for accessing protected content. Configure your API requests with the necessary credentials to extract data from login-protected documentation, knowledge bases, or member-only sites.
  </Accordion>

  <Accordion title="Can I use Firecrawl for real-time AI applications?">
    Yes! Our API supports real-time data extraction, enabling AI applications to access fresh web data on-demand. This is perfect for AI agents that need current information to make decisions.
  </Accordion>
</AccordionGroup>

## Related Use Cases

* [Deep Research](/use-cases/deep-research) - Advanced research capabilities
* [Content Generation](/use-cases/content-generation) - AI-powered content creation
* [Developers & MCP](/use-cases/developers-mcp) - Developer integrations

---

# Competitive Intelligence

> Monitor competitor websites and track changes in real-time

Business intelligence teams use Firecrawl to monitor competitors and get alerts on strategic changes.

## Start with a Template

<CardGroup cols={2}>
  <Card title="Firecrawl Observer" icon="github" href="https://github.com/mendableai/firecrawl-observer">
    Real-time website monitoring with intelligent alerts
  </Card>

  <Card title="Fireplexity" icon="github" href="https://github.com/mendableai/fireplexity">
    Research and analyze competitor strategies with AI
  </Card>
</CardGroup>

<Note>
  **Choose from monitoring and research templates.** Track competitors and analyze their strategies.
</Note>

## How It Works

Stay ahead of the competition with automated monitoring. Track product launches, pricing changes, marketing campaigns, and strategic moves across competitor websites and online properties.

## What You Can Track

* **Products**: New launches, features, specs, pricing, documentation
* **Marketing**: Messaging changes, campaigns, case studies, testimonials
* **Business**: Job postings, partnerships, funding, press releases
* **Strategy**: Positioning, target markets, pricing approaches, go-to-market
* **Technical**: API changes, integrations, technology stack updates

## FAQs

<AccordionGroup>
  <Accordion title="How quickly can I detect changes?">
    Firecrawl extracts current page content whenever called. Build your own monitoring system to check competitors at intervals that match your needs - from hourly for critical updates to daily for routine tracking.
  </Accordion>

  <Accordion title="Can I monitor competitors in different regions?">
    Yes, Firecrawl can access region-specific content. You can monitor different versions of competitor sites across multiple countries and languages.
  </Accordion>

  <Accordion title="How do I avoid false positive alerts?">
    When building your monitoring system, implement filters to ignore minor changes like timestamps or dynamic content. Compare extracted data over time and use your own logic to determine what constitutes a meaningful change.
  </Accordion>

  <Accordion title="Can I track competitor social media and PR activity?">
    Yes. Extract data from competitor press releases, blog posts, and public social media pages. Build systems to analyze announcement patterns, messaging changes, and campaign launches over time.
  </Accordion>

  <Accordion title="How do I organize intelligence across multiple competitors?">
    Extract data from multiple competitor sites using Firecrawl's APIs. Build your own system to organize and compare this data - many users create databases with competitor profiles and custom dashboards for analysis.
  </Accordion>
</AccordionGroup>

## Related Use Cases

* [Product & E-commerce](/use-cases/product-ecommerce) - Track competitor products
* [Investment & Finance](/use-cases/investment-finance) - Market intelligence
* [SEO Platforms](/use-cases/seo-platforms) - search competitor tracking

---

# Content Generation

> Generate AI content based on website data, images, and news

Content teams use Firecrawl to generate personalized presentations, emails, marketing materials, and news-driven updates with real-time web data.

## Start with a Template

<Card title="Open Lovable" icon="github" href="https://github.com/mendableai/open-lovable">
  Clone and recreate any website as a modern React app
</Card>

<Note>
  **Get started with the Open Lovable template.** Transform websites into content and applications.
</Note>

## How It Works

Firecrawl extracts insights from websites in multiple formats — including structured HTML, Markdown, JSON, and screenshots. It can also capture images and surface relevant news stories as part of your request. This means your AI content is both factually grounded and visually enriched with the latest context.

## What You Can Create

* **Sales Decks**: Custom presentations with prospect data
* **Email Campaigns**: Personalized outreach at scale
* **Marketing Content**: Data-driven blog posts and reports
* **Social Media**: Trending topic and news-driven content generation
* **Documentation**: Auto-updated technical content
* **Newsletters**: Curated updates from industry and competitor news
* **Visual Content**: Posts and reports enriched with extracted images and screenshots

## FAQs

<AccordionGroup>
  <Accordion title="How does Firecrawl ensure data accuracy for content creation?">
    Firecrawl extracts data directly from source websites, preserving the original content structure and context. All extracted data includes source URLs and timestamps for verification.
  </Accordion>

  <Accordion title="What data can Firecrawl provide for content generation?">
    Firecrawl provides clean markdown, structured JSON, HTML, images, and screenshots from websites. This extracted data serves as the factual foundation for your content generation workflows.
  </Accordion>

  <Accordion title="Can Firecrawl handle images and news sources?">
    Yes. Firecrawl can extract images, capture screenshots, and pull content from news sites. This enables you to create visually rich content and stay current with industry developments.
  </Accordion>

  <Accordion title="What types of websites can Firecrawl extract from?">
    Firecrawl excels at extracting from company websites, news sites, blogs, and documentation. Sites with structured HTML and clear content hierarchies yield the cleanest extraction results.
  </Accordion>

  <Accordion title="How can I use Firecrawl for bulk data extraction?">
    Use Firecrawl's batch scraping and crawl APIs to extract data from multiple websites efficiently. Process hundreds of URLs in parallel to build comprehensive datasets for your content workflows.
  </Accordion>
</AccordionGroup>

## Related Use Cases

* [AI Platforms](/use-cases/ai-platforms) - Build AI-powered content tools
* [Lead Enrichment](/use-cases/lead-enrichment) - Personalize with prospect data
* [SEO Platforms](/use-cases/seo-platforms) - Optimize generated content

---

# Data Migration

> Transfer web data efficiently between platforms and systems

Migration teams use Firecrawl to transfer content between platforms and streamline customer onboarding from competitors.

## Start with a Template

<Card title="Firecrawl Migrator" icon="github" href="https://github.com/mendableai/firecrawl-migrator">
  Efficiently migrate data between platforms and systems
</Card>

<Note>
  **Get started with the Firecrawl Migrator template.** Extract and transform data for platform migrations.
</Note>

## How It Works

Use Firecrawl to extract data from existing websites for migration projects. Pull content, structure, and metadata from your current platform, then transform and import it into your new system using your preferred migration tools.

## What You Can Migrate

* **Content**: Pages, posts, articles, media files, metadata
* **Structure**: Hierarchies, categories, tags, taxonomies
* **Users**: Profiles and user-related data where publicly accessible
* **Settings**: Configurations, custom fields, workflows
* **E-commerce**: Products, catalogs, inventory, orders

## Common Migration Use Cases

Users build migration tools with Firecrawl to extract data from various platforms:

### CMS Content Extraction

* Extract content from WordPress, Drupal, Joomla sites
* Pull data from custom CMS platforms
* Preserve content structure and metadata
* Export for import into new systems like Contentful, Strapi, or Sanity

### E-commerce Data Extraction

* Extract product catalogs from Magento, WooCommerce stores
* Pull inventory and pricing data
* Capture product descriptions and specifications
* Format data for import into Shopify, BigCommerce, or other platforms

## FAQs

<AccordionGroup>
  <Accordion title="How do you handle large-scale migrations?">
    Our infrastructure scales automatically to handle large migrations. We support incremental processing with batching and parallel extraction, allowing you to migrate millions of pages by breaking them into manageable chunks with progress tracking.
  </Accordion>

  <Accordion title="Can I preserve SEO value during migration?">
    Yes! Extract all SEO metadata including URLs, titles, descriptions, and implement proper redirects. We help maintain your search rankings through the migration.
  </Accordion>

  <Accordion title="What about media files and attachments?">
    Firecrawl can extract and catalog all media files. You can download them for re-upload to your new platform or reference them directly if keeping the same CDN.
  </Accordion>

  <Accordion title="How do I validate the migration?">
    We provide detailed extraction reports and support comparison tools. You can verify content completeness, check broken links, and validate data integrity.
  </Accordion>

  <Accordion title="Can I migrate user-generated content and comments?">
    Yes, you can extract publicly visible user-generated content including comments, reviews, and forum posts. Private user data requires appropriate authentication and permissions.
  </Accordion>
</AccordionGroup>

## Related Use Cases

* [Product & E-commerce](/use-cases/product-ecommerce) - Catalog migrations
* [Content Generation](/use-cases/content-generation) - Content transformation
* [AI Platforms](/use-cases/ai-platforms) - Knowledge base migration

---

# Deep Research

> Build agentic research tools with deep web search capabilities

Academic researchers and analysts use Firecrawl's deep research mode to aggregate data from hundreds of sources automatically.

## Start with a Template

<CardGroup>
  <Card title="Fireplexity" icon="github" href="https://github.com/mendableai/fireplexity">
    Blazing-fast AI search with real-time citations
  </Card>

  <Card title="Firesearch" icon="github" href="https://github.com/mendableai/firesearch">
    Deep research agent with LangGraph and answer validation
  </Card>

  <Card title="Open Researcher" icon="github" href="https://github.com/mendableai/open-researcher">
    Visual AI research assistant for comprehensive analysis
  </Card>
</CardGroup>

<Note>
  **Choose from multiple research templates.** Clone, configure your API key, and start researching.
</Note>

## How It Works

Build powerful research tools that transform scattered web data into comprehensive insights. Use Firecrawl's APIs to iteratively explore topics, discover sources, and extract content with full citations for your research applications.

## Why Researchers Choose Firecrawl

### Accelerate Research from Weeks to Hours

Build automated research systems that discover, read, and synthesize information from across the web. Create tools that deliver comprehensive reports with full citations, eliminating manual searching through hundreds of sources.

### Ensure Research Completeness

Reduce the risk of missing critical information. Build systems that follow citation chains, discover related sources, and surface insights that traditional search methods miss.

## Research Tool Capabilities

* **Iterative Exploration**: Build tools that automatically discover related topics and sources
* **Multi-Source Synthesis**: Combine information from hundreds of websites
* **Citation Preservation**: Maintain full source attribution in your research outputs
* **Intelligent Summarization**: Extract key findings and insights for analysis
* **Trend Detection**: Identify patterns across multiple sources

## FAQs

<AccordionGroup>
  <Accordion title="How can I build research tools with Firecrawl?">
    Use Firecrawl's crawl and search APIs to build iterative research systems. Start with search results, extract content from relevant pages, follow citation links, and aggregate findings. Combine with LLMs to synthesize comprehensive research reports.
  </Accordion>

  <Accordion title="Can Firecrawl handle academic and scientific websites?">
    Yes. Firecrawl can extract data from open-access research papers, academic websites, and publicly available scientific publications. It preserves formatting, citations, and technical content critical for research work.
  </Accordion>

  <Accordion title="How do I ensure research data accuracy?">
    Firecrawl maintains source attribution and extracts content exactly as presented on websites. All data includes source URLs and timestamps, ensuring full traceability for research purposes.
  </Accordion>

  <Accordion title="Can I use Firecrawl for longitudinal studies?">
    Yes. Set up scheduled crawls to track how information changes over time. This is perfect for monitoring trends, policy changes, or any research requiring temporal data analysis.
  </Accordion>

  <Accordion title="How does Firecrawl handle large-scale research projects?">
    Our crawling infrastructure scales to handle thousands of sources simultaneously. Whether you're analyzing entire industries or tracking global trends, Firecrawl provides the data pipeline you need.
  </Accordion>
</AccordionGroup>

## Related Use Cases

* [AI Platforms](/use-cases/ai-platforms) - Build AI research assistants
* [Content Generation](/use-cases/content-generation) - Research-based content
* [Competitive Intelligence](/use-cases/competitive-intelligence) - Market research

---

# Developers & MCP

> Build powerful integrations with Model Context Protocol support

Developers use Firecrawl's MCP server to add web scraping to Claude Desktop, Cursor, and other AI coding assistants.

## Start with a Template

<CardGroup cols={2}>
  <Card title="MCP Server Firecrawl" icon="github" href="https://github.com/mendableai/firecrawl-mcp-server">
    Official MCP server - Add web scraping to Claude Desktop and Cursor
  </Card>

  <Card title="Open Lovable" icon="github" href="https://github.com/mendableai/open-lovable">
    Build complete applications from any website instantly
  </Card>
</CardGroup>

<Note>
  **Get started with MCP in minutes.** Follow our [setup guide](https://github.com/mendableai/firecrawl-mcp-server#installation) to integrate Firecrawl into Claude Desktop or Cursor.
</Note>

## How It Works

Integrate Firecrawl directly into your AI coding workflow. Research documentation, fetch API specs, and access web data without leaving your development environment through Model Context Protocol.

## Why Developers Choose Firecrawl MCP

### Build Smarter AI Assistants

Give your AI real-time access to documentation, APIs, and web resources. Reduce outdated information and hallucinations by providing your assistant with the latest data.

### Zero Infrastructure Required

No servers to manage, no crawlers to maintain. Just configure once and your AI assistant can access websites instantly through the Model Context Protocol.

## Customer Stories

<CardGroup cols={2}>
  <Card href="https://www.firecrawl.dev/blog/how-botpress-enhances-knowledge-base-creation-with-firecrawl">
    **Botpress**

    Discover how Botpress uses Firecrawl to streamline knowledge base population and improve developer experience.
  </Card>

  <Card href="https://www.firecrawl.dev/blog/how-answer-hq-powers-ai-customer-support-with-firecrawl">
    **Answer HQ**

    Learn how Answer HQ uses Firecrawl to help businesses import website data and build intelligent support assistants.
  </Card>
</CardGroup>

## FAQs

<AccordionGroup>
  <Accordion title="Which AI assistants support MCP?">
    Currently, Claude Desktop and Cursor have native MCP support. More AI assistants are adding support regularly. You can also use the MCP SDK to build custom integrations.
  </Accordion>

  <Accordion title="Can I use MCP in VS Code or other IDEs?">
    VS Code and other IDEs can use MCP through community extensions or terminal integrations. Native support varies by IDE. Check our [GitHub repository](https://github.com/mendableai/firecrawl-mcp-server) for IDE-specific setup guides.
  </Accordion>

  <Accordion title="How do I cache frequently accessed docs?">
    The MCP server automatically caches responses for 15 minutes. You can configure cache duration in your MCP server settings or implement custom caching logic.
  </Accordion>

  <Accordion title="Is there a rate limit for MCP requests?">
    MCP requests use your standard Firecrawl API rate limits. We recommend batching related requests and using caching for frequently accessed documentation.
  </Accordion>

  <Accordion title="How do I set up MCP with my Firecrawl API key?">
    Follow our [setup guide](https://github.com/mendableai/firecrawl-mcp-server#installation) to configure MCP. You'll need to add your Firecrawl API key to your MCP configuration file. The process takes just a few minutes.
  </Accordion>
</AccordionGroup>

## Related Use Cases

* [AI Platforms](/use-cases/ai-platforms) - Build AI-powered dev tools
* [Deep Research](/use-cases/deep-research) - Complex technical research
* [Content Generation](/use-cases/content-generation) - Generate documentation

---

# Investment & Finance

> Track companies and extract financial insights from web data

Hedge funds, VCs, and financial analysts use Firecrawl to monitor portfolio companies and gather market intelligence.

## Start with a Template

<Card title="Firecrawl Observer" icon="github" href="https://github.com/mendableai/firecrawl-observer">
  Monitor portfolio companies for material changes and trigger events
</Card>

<Note>
  **Get started with the Firecrawl Observer template.** Monitor portfolio companies and market changes.
</Note>

## How It Works

Extract financial signals from across the web. Monitor portfolio companies, track market movements, and support due diligence workflows with real-time web data extraction.

## What You Can Track

* **Company Metrics**: Growth indicators, team changes, product launches, funding rounds
* **Market Signals**: Industry trends, competitor moves, sentiment analysis, regulatory changes
* **Risk Indicators**: Leadership changes, legal issues, regulatory mentions, customer complaints
* **Financial Data**: Pricing updates, revenue signals, partnership announcements
* **Alternative Data**: Job postings, web traffic, social signals, news mentions

## Customer Stories

<CardGroup cols={2}>
  <Card href="https://www.firecrawl.dev/blog/how-athena-intelligence-empowers-analysts-with-firecrawl">
    **Athena Intelligence**

    Discover how Athena Intelligence leverages Firecrawl to fuel its AI-native analytics platform for enterprise analysts.
  </Card>

  <Card href="https://www.firecrawl.dev/blog/how-cargo-empowers-gtm-teams-with-firecrawl">
    **Cargo**

    See how Cargo uses Firecrawl to analyze market data and power revenue intelligence workflows.
  </Card>
</CardGroup>

## FAQs

<AccordionGroup>
  <Accordion title="Can I track private companies?">
    Yes, you can monitor publicly available information about private companies from their websites, news mentions, job postings, and social media presence.
  </Accordion>

  <Accordion title="How real-time is the data?">
    Firecrawl extracts data in real-time when called. Build your own monitoring system to fetch data at intervals that match your investment strategy - from minute-by-minute for critical events to daily for routine tracking.
  </Accordion>

  <Accordion title="What alternative data sources can I monitor?">
    Public web sources such as company websites, news sites, job boards, review sites, forums, social media, government filings, and open-access industry data.
  </Accordion>

  <Accordion title="How can I track ESG and sustainability signals?">
    Extract data from company ESG reports, sustainability pages, news mentions of environmental initiatives, and regulatory filings. Build tracking systems to identify changes in sustainability commitments or ESG-related developments.
  </Accordion>

  <Accordion title="Can Firecrawl help with earnings call preparation?">
    Yes. Extract recent company updates, product launches, executive changes, and industry trends before earnings calls. Combine with competitor data to anticipate questions and identify key discussion points.
  </Accordion>
</AccordionGroup>

## Related Use Cases

* [Competitive Intelligence](/use-cases/competitive-intelligence) - Track market competitors
* [Deep Research](/use-cases/deep-research) - Comprehensive market analysis
* [Lead Enrichment](/use-cases/lead-enrichment) - B2B investment opportunities

---

# Lead Enrichment

> Extract and filter leads from websites to power your sales pipeline

Sales ops and BizDev teams use Firecrawl to scrape directories for leads, enrich CRM data, and automate account research.

## Start with a Template

<Card title="Fire Enrich" icon="github" href="https://github.com/mendableai/fire-enrich">
  AI-powered lead enrichment and data extraction from websites
</Card>

<Note>
  **Get started with the Fire Enrich template.** Extract and enrich lead data from websites.
</Note>

## How It Works

Turn the web into your most powerful prospecting tool. Extract company information, find decision makers, and enrich your CRM with real-time data from company websites.

## Why Sales Teams Choose Firecrawl

### Transform Directories into Pipeline

Every industry directory is a goldmine of potential customers. Firecrawl extracts thousands of qualified leads from business directories, trade associations, and conference attendee lists-complete with company details and contact information.

### Enrich CRM Data Automatically

Stop paying for stale data from traditional providers. Firecrawl pulls real-time information directly from company websites, ensuring your sales team always has the latest company news, team changes, and growth signals.

## Customer Stories

<CardGroup cols={2}>
  <Card href="https://www.firecrawl.dev/blog/how-zapier-uses-firecrawl-to-power-chatbots">
    **Zapier**

    Discover how Zapier uses Firecrawl to empower customers with custom knowledge in their chatbots.
  </Card>

  <Card href="https://www.firecrawl.dev/blog/how-cargo-empowers-gtm-teams-with-firecrawl">
    **Cargo**

    See how Cargo uses Firecrawl to instantly analyze webpage content and power Go-To-Market workflows.
  </Card>
</CardGroup>

## Lead Sources

### Business Directories

* Industry-specific directories
* Chamber of commerce listings
* Trade association members
* Conference attendee lists

### Company Websites

* About pages and team sections
* Press releases and news
* Job postings for growth signals
* Customer case studies

## FAQs

<AccordionGroup>
  <Accordion title="How does Firecrawl enhance lead enrichment processes?">
    Firecrawl automatically extracts company information, contact details, product offerings, and recent news from prospect websites. This enriches your CRM with accurate, up-to-date information for better sales outreach.
  </Accordion>

  <Accordion title="Can Firecrawl find contact information from websites?">
    Yes! Firecrawl extracts publicly available contact information including emails and phone numbers from company websites, team pages, and contact sections.
  </Accordion>

  <Accordion title="How accurate is the lead data from Firecrawl?">
    Since Firecrawl extracts data directly from live websites, you get the most current information available. This is more accurate than static databases that quickly become outdated.
  </Accordion>

  <Accordion title="Can I integrate Firecrawl with my CRM?">
    Yes. Use our API or Zapier integration to automatically enrich leads in Salesforce, HubSpot, Pipedrive, and other CRMs. Keep your lead data fresh without manual research.
  </Accordion>

  <Accordion title="How does Firecrawl help with account-based marketing?">
    Extract detailed company information, recent updates, and trigger events from target account websites. This intelligence helps personalize outreach and identify the perfect timing for engagement.
  </Accordion>
</AccordionGroup>

## Related Use Cases

* [AI Platforms](/use-cases/ai-platforms) - Build AI sales assistants
* [Competitive Intelligence](/use-cases/competitive-intelligence) - Track competitors
* [Investment & Finance](/use-cases/investment-finance) - Investment opportunities

---

# Observability & Monitoring

> Monitor websites, track uptime, and detect changes in real-time

DevOps and SRE teams use Firecrawl to monitor websites, track availability, and detect critical changes across their digital infrastructure.

## Start with a Template

<Card title="Firecrawl Observer" icon="github" href="https://github.com/mendableai/firecrawl-observer">
  Real-time website monitoring and intelligent change detection
</Card>

<Note>
  **Get started with the Firecrawl Observer template.** Monitor websites and track changes in real-time.
</Note>

## How It Works

Use Firecrawl's extraction capabilities to build observability systems for your websites. Extract page content, analyze changes over time, validate deployments, and create monitoring workflows that ensure your sites function correctly.

## What You Can Monitor

* **Availability**: Uptime, response times, error rates
* **Content**: Text changes, image updates, layout shifts
* **Performance**: Page load times, resource sizes, Core Web Vitals
* **Security**: SSL certificates, security headers, misconfigurations
* **SEO Health**: Meta tags, structured data, sitemap validity

## Monitoring Types

### Synthetic Monitoring

* User journey validation
* Transaction monitoring
* Multi-step workflows
* Cross-browser testing

### Content Monitoring

* Text change detection
* Visual regression testing
* Dynamic content validation
* Internationalization checks

## FAQs

<AccordionGroup>
  <Accordion title="How does Firecrawl help with website monitoring?">
    Firecrawl extracts website content and structure on demand. Build monitoring systems that call Firecrawl's API to check pages, compare extracted data against baselines, and trigger your own alerts when changes occur.
  </Accordion>

  <Accordion title="Can I monitor JavaScript-heavy applications?">
    Yes! Firecrawl fully renders JavaScript, making it perfect for monitoring modern SPAs, React apps, and dynamic content. We capture the page as users see it, not just the raw HTML.
  </Accordion>

  <Accordion title="How quickly can I detect website issues?">
    Firecrawl extracts data in real-time when called. Build your monitoring system to check sites at whatever frequency you need - from minute-by-minute for critical pages to daily for routine checks.
  </Accordion>

  <Accordion title="Can I validate specific page elements?">
    Yes. Use the extract API to pull specific elements like prices, inventory levels, or critical content. Build validation logic in your monitoring system to verify that important information is present and correct.
  </Accordion>

  <Accordion title="How can I integrate Firecrawl with alerting systems?">
    Firecrawl provides webhooks that you can use to build integrations with your alerting tools. Send extracted data to PagerDuty, Slack, email, or any monitoring platform by building connectors that process Firecrawl's responses.
  </Accordion>
</AccordionGroup>

## Related Use Cases

* [Competitive Intelligence](/use-cases/competitive-intelligence) - Monitor competitor changes
* [Product & E-commerce](/use-cases/product-ecommerce) - Track inventory and pricing
* [Data Migration](/use-cases/data-migration) - Validate migrations

---

# SEO Platforms

> Optimize websites for AI assistants and search engines

SEO platforms and consultants use Firecrawl to optimize websites for AI assistants and search engines.

## Start with a Template

<Card title="FireGEO" icon="github" href="https://github.com/mendableai/firegeo">
  GEO-powered SEO monitoring and multi-region rank tracking
</Card>

<Note>
  **Get started with the FireGEO template.** Optimize for both search engines and AI assistants.
</Note>

## How It Works

Prepare your website for the AI-first future. Audit AI readability and ensure your content is discoverable by both traditional search engines and AI assistants.

## Why SEO Platforms Choose Firecrawl

### Optimize for AI Discovery, Not Just Google

The future of search is AI-powered. While competitors focus on traditional SEO, forward-thinking platforms use Firecrawl to increase their clients' visibility in AI assistant responses-the new frontier of organic discovery.

### Complete Site Intelligence at Scale

Analyze entire websites, not just sample pages. Extract every meta tag, header structure, internal link, and content element across thousands of pages simultaneously. Identify optimization opportunities your competitors miss.

## What You Can Build

* **AI Readability Audit**: Optimize for AI comprehension
* **Content Analysis**: Structure and semantic optimization
* **Technical SEO**: Site performance and crawlability
* **search Tracking**: Monitor search engine positions

## FAQs

<AccordionGroup>
  <Accordion title="How can I optimize my site for AI assistants?">
    Firecrawl helps you structure content for optimal AI comprehension, extract semantic signals, and ensure your site follows best practices for AI discovery. This includes generating experimental formats like llms.txt (an emerging convention for AI crawler guidance).
  </Accordion>

  <Accordion title="How does Firecrawl support SEO audits?">
    Firecrawl extracts complete site structures, meta tags, headers, internal links, and content to perform comprehensive SEO audits. Identify optimization opportunities and track improvements over time.
  </Accordion>

  <Accordion title="Can Firecrawl help with competitor SEO analysis?">
    Yes. Analyze competitor site structures, keyword usage, content strategies, and technical SEO implementations. Understand what's working in your industry to inform your strategy.
  </Accordion>

  <Accordion title="How can I use Firecrawl for content gap analysis?">
    Crawl competitor sites to identify topics they cover that you don't. Extract their content categories, blog topics, and page structures to find opportunities for new content.
  </Accordion>

  <Accordion title="Does Firecrawl help with technical SEO monitoring?">
    Yes. Identify broken links, track redirect chains, extract canonical tags, and monitor meta tag implementation. Regular crawls help identify technical SEO issues across your site.
  </Accordion>
</AccordionGroup>

## Related Use Cases

* [AI Platforms](/use-cases/ai-platforms) - Build AI-powered SEO tools
* [Competitive Intelligence](/use-cases/competitive-intelligence) - Track competitor SEO
* [Content Generation](/use-cases/content-generation) - Create SEO content

---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.firecrawl.dev/llms.txt
