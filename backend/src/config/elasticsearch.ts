import { Client } from "@elastic/elasticsearch";

const node = process.env.ELASTICSEARCH_URL;
const apiKey = process.env.ELASTICSEARCH_API_KEY;

export const elasticsearch =
  node
    ? new Client({
        node,
        ...(apiKey
          ? {
              auth: {
                apiKey,
              },
            }
          : {}),
      })
    : null;

export const EMAIL_INDEX =
  "reachinbox-emails";

export const isElasticsearchConfigured =
  Boolean(node);