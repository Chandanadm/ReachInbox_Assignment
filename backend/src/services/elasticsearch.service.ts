import {
  elasticsearch,
  EMAIL_INDEX,
  isElasticsearchConfigured,
} from "../config/elasticsearch.js";

interface EmailSearchDocument {
  userId: string;
  emailId: string;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  failureReason: string | null;
}

export const initializeEmailIndex =
  async (): Promise<void> => {
    if (!elasticsearch || !isElasticsearchConfigured) {
      console.warn(
        "Elasticsearch is not configured. Search/indexing is disabled.",
      );
      return;
    }

    const exists =
      await elasticsearch.indices.exists({
        index: EMAIL_INDEX,
      });

    if (!exists) {
      await elasticsearch.indices.create({
        index: EMAIL_INDEX,
        mappings: {
          properties: {
            userId: {
              type: "keyword",
            },
            emailId: {
              type: "keyword",
            },
            recipientEmail: {
              type: "keyword",
            },
            recipientName: {
              type: "text",
            },
            subject: {
              type: "text",
            },
            body: {
              type: "text",
            },
            status: {
              type: "keyword",
            },
            scheduledAt: {
              type: "date",
            },
            sentAt: {
              type: "date",
            },
            failureReason: {
              type: "text",
            },
          },
        },
      });

      console.log(
        `Elasticsearch index "${EMAIL_INDEX}" created.`,
      );
    }
  };

export const indexEmail = async (
  document: EmailSearchDocument,
): Promise<void> => {
  if (!elasticsearch || !isElasticsearchConfigured) {
    console.warn(
      "Elasticsearch is not configured. Email was not indexed.",
    );
    return;
  }

  await elasticsearch.index({
    index: EMAIL_INDEX,
    id: document.emailId,
    document,
    refresh: "wait_for",
  });
};

export const searchEmails = async (
  userId: string,
  query: string,
): Promise<EmailSearchDocument[]> => {
  if (!elasticsearch || !isElasticsearchConfigured) {
    throw new Error(
      "Elasticsearch is not configured.",
    );
  }

  const result =
    await elasticsearch.search<EmailSearchDocument>({
      index: EMAIL_INDEX,
      size: 50,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: [
                  "recipientEmail",
                  "recipientName",
                  "subject",
                  "body",
                ],
              },
            },
          ],
          filter: [
            {
              term: {
                userId,
              },
            },
          ],
        },
      },
      sort: [
        {
          scheduledAt: {
            order: "desc",
          },
        },
      ],
    });

  return result.hits.hits
    .map((hit) => hit._source)
    .filter(
      (
        document,
      ): document is EmailSearchDocument =>
        document !== undefined,
    );
};