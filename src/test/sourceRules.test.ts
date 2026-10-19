import { describe, it, expect } from "vitest";
import { activeSourceFilter, sourceFetchUrl, validPublishedAt } from "../../supabase/functions/_shared/sourceRules";
import { sourceInput } from "../lib/sourceInput";

describe("RSS source rules", () => {
  it("prefers the administrator's feed URL to a legacy website URL", () => {
    expect(sourceFetchUrl({feed_url:" https://feeds.bbci.co.uk/news/world/rss.xml ",url:"https://bbc.com"})).toBe("https://feeds.bbci.co.uk/news/world/rss.xml");
  });
  it("excludes disabled sources even for targeted fetching", () => {
    expect(activeSourceFilter("source-test")).toEqual({is_active:true,id:"source-test"});
  });
  it("new RSS sources keep RSS mode when the feed is entered into the main URL field", () => {
    expect(sourceInput(" BBC ","https://feeds.bbci.co.uk/news/world/rss.xml","","rss")).toMatchObject({name:"BBC",url:"https://feeds.bbci.co.uk/news/world/rss.xml",fetch_type:"rss"});
  });
  it("prevents invalid URLs from being saved", () => {
    expect(()=>sourceInput("BBC","not a URL","","rss")).toThrow();
  });
  it("does not drop an article due to an invalid feed date", () => {
    expect(validPublishedAt("invalid",new Date("2026-10-19T00:00:00Z"))).toBe("2026-10-19T00:00:00.000Z");
  });
});