import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  Mail,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  useState,
} from "react";
import axios from "axios";

interface ComposeEmailFormProps {
  onSuccess?: () => void;
}

interface ScheduleResponse {
  success: boolean;
  message: string;
  data?: {
    batchId: string;
    totalRecipients: number;
    startTime: string;
    delaySeconds: number;
    hourlyLimit: number | null;
  };
}

const API_URL = "http://localhost:5000";

const ComposeEmailForm = ({
  onSuccess,
}: ComposeEmailFormProps) => {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [recipientText, setRecipientText] =
    useState("");
  const [recipients, setRecipients] = useState<
    string[]
  >([]);

  const [startTime, setStartTime] = useState("");
  const [delaySeconds, setDelaySeconds] =
    useState("0");
  const [hourlyLimit, setHourlyLimit] =
    useState("100");

  const [fileName, setFileName] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const extractEmails = (
    text: string,
  ): string[] => {
    const emailPattern =
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    const matches =
      text.match(emailPattern) ?? [];

    return Array.from(
      new Set(
        matches.map((email) =>
          email.trim().toLowerCase(),
        ),
      ),
    );
  };

  const handleRecipientTextChange = (
    value: string,
  ) => {
    setRecipientText(value);

    const emails = extractEmails(value);

    setRecipients(emails);

    setError("");
    setSuccess("");
  };

  const handleFileUpload = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setFileName(file.name);
    setError("");
    setSuccess("");

    const reader = new FileReader();

    reader.onload = () => {
      const content = String(
        reader.result ?? "",
      );

      const emails = extractEmails(content);

      if (emails.length === 0) {
        setRecipients([]);
        setError(
          "No valid email addresses were found in the uploaded file.",
        );
        return;
      }

      setRecipientText(emails.join("\n"));
      setRecipients(emails);

      setSuccess(
        `${emails.length} recipient${
          emails.length === 1 ? "" : "s"
        } found in ${file.name}.`,
      );
    };

    reader.onerror = () => {
      setError(
        "Unable to read the selected file. Please try again.",
      );
    };

    reader.readAsText(file);
  };

  const removeRecipient = (
    email: string,
  ) => {
    const updatedRecipients =
      recipients.filter(
        (recipient) =>
          recipient !== email,
      );

    setRecipients(updatedRecipients);
    setRecipientText(
      updatedRecipients.join("\n"),
    );
  };

  const clearRecipients = () => {
    setRecipients([]);
    setRecipientText("");
    setFileName("");
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!subject.trim()) {
      setError(
        "Please enter an email subject.",
      );
      return;
    }

    if (!body.trim()) {
      setError(
        "Please enter the email body.",
      );
      return;
    }

    if (recipients.length === 0) {
      setError(
        "Please add at least one valid recipient email.",
      );
      return;
    }

    if (!startTime) {
      setError(
        "Please select a start time.",
      );
      return;
    }

    const delay = Number(delaySeconds);
    const limit = Number(hourlyLimit);

    if (
      !Number.isInteger(delay) ||
      delay < 0
    ) {
      setError(
        "Delay must be a whole number greater than or equal to 0.",
      );
      return;
    }

    if (
      !Number.isInteger(limit) ||
      limit <= 0
    ) {
      setError(
        "Hourly limit must be a whole number greater than 0.",
      );
      return;
    }

    const token =
      localStorage.getItem(
        "reachinbox_token",
      );

    if (!token) {
      setError(
        "Your session has expired. Please sign in again.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const response =
        await axios.post<ScheduleResponse>(
          `${API_URL}/api/emails/schedule`,
          {
            subject: subject.trim(),
            body: body.trim(),
            recipients: recipients.map(
              (email) => ({
                email,
              }),
            ),
            startTime: new Date(
              startTime,
            ).toISOString(),
            delaySeconds: delay,
            hourlyLimit: limit,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type":
                "application/json",
            },
          },
        );

      if (!response.data.success) {
        setError(
          response.data.message ||
            "Unable to schedule campaign.",
        );
        return;
      }

      const recipientCount =
        response.data.data
          ?.totalRecipients ??
        recipients.length;

      setSuccess(
        `Campaign scheduled successfully for ${recipientCount} recipient${
          recipientCount === 1
            ? ""
            : "s"
        }.`,
      );

      setSubject("");
      setBody("");
      setRecipientText("");
      setRecipients([]);
      setStartTime("");
      setDelaySeconds("0");
      setHourlyLimit("100");
      setFileName("");

      onSuccess?.();
    } catch (requestError) {
      if (
        axios.isAxiosError(
          requestError,
        )
      ) {
        const serverMessage =
          requestError.response?.data
            ?.message;

        setError(
          serverMessage ||
            "Unable to schedule the campaign. Please try again.",
        );
      } else {
        setError(
          "Unable to schedule the campaign. Please try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className="compose-form"
      onSubmit={handleSubmit}
    >
      {error && (
        <div className="form-alert form-alert-error">
          <AlertCircle size={18} />

          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="form-alert form-alert-success">
          <CheckCircle2 size={18} />

          <span>{success}</span>
        </div>
      )}

      <div className="form-field">
        <label htmlFor="email-subject">
          Subject
        </label>

        <input
          id="email-subject"
          type="text"
          value={subject}
          onChange={(event) =>
            setSubject(
              event.target.value,
            )
          }
          placeholder="Enter your email subject"
          maxLength={200}
        />

        <span className="field-hint">
          {subject.length}/200 characters
        </span>
      </div>

      <div className="form-field">
        <label htmlFor="email-body">
          Email Body
        </label>

        <textarea
          id="email-body"
          value={body}
          onChange={(event) =>
            setBody(event.target.value)
          }
          placeholder="Write your email message..."
          rows={9}
        />

        <span className="field-hint">
          Plain text email content for now.
        </span>
      </div>

      <div className="form-field">
        <div className="field-label-row">
          <label htmlFor="recipient-list">
            Recipients
          </label>

          {recipients.length > 0 && (
            <span className="recipient-count">
              <Users size={14} />

              {recipients.length} recipient
              {recipients.length === 1
                ? ""
                : "s"}
            </span>
          )}
        </div>

        <textarea
          id="recipient-list"
          value={recipientText}
          onChange={(event) =>
            handleRecipientTextChange(
              event.target.value,
            )
          }
          placeholder={
            "Enter email addresses separated by commas, spaces, or new lines.\n\nExample:\nuser1@example.com\nuser2@example.com"
          }
          rows={7}
        />

        <div className="recipient-actions">
          <label
            htmlFor="lead-file"
            className="upload-button"
          >
            <Upload size={16} />
            Upload CSV / TXT
          </label>

          <input
            id="lead-file"
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            onChange={handleFileUpload}
            hidden
          />

          {fileName && (
            <div className="selected-file">
              <FileText size={15} />

              <span>{fileName}</span>

              <button
                type="button"
                onClick={clearRecipients}
                aria-label="Remove uploaded file"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        <span className="field-hint">
          CSV files can contain email addresses
          in any column.
        </span>
      </div>

      {recipients.length > 0 && (
        <div className="recipient-preview">
          <div className="recipient-preview-header">
            <div>
              <strong>
                Recipients ready
              </strong>

              <span>
                {recipients.length} unique
                email
                {recipients.length === 1
                  ? ""
                  : "s"}
              </span>
            </div>

            <button
              type="button"
              onClick={
                clearRecipients
              }
            >
              Clear all
            </button>
          </div>

          <div className="recipient-list">
            {recipients
              .slice(0, 8)
              .map((email) => (
                <div
                  className="recipient-chip"
                  key={email}
                >
                  <Mail size={13} />

                  <span>{email}</span>

                  <button
                    type="button"
                    onClick={() =>
                      removeRecipient(
                        email,
                      )
                    }
                    aria-label={`Remove ${email}`}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}

            {recipients.length > 8 && (
              <span className="more-recipients">
                +{recipients.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}

      <div className="schedule-section">
        <div className="schedule-heading">
          <Clock3 size={18} />

          <div>
            <h3>
              Delivery Settings
            </h3>

            <p>
              Control when and how quickly
              your emails are sent.
            </p>
          </div>
        </div>

        <div className="schedule-grid">
          <div className="form-field">
            <label htmlFor="start-time">
              Start Time
            </label>

            <input
              id="start-time"
              type="datetime-local"
              value={startTime}
              onChange={(event) =>
                setStartTime(
                  event.target.value,
                )
              }
            />

            <span className="field-hint">
              When the first email should
              be processed.
            </span>
          </div>

          <div className="form-field">
            <label htmlFor="delay-seconds">
              Delay Between Emails
            </label>

            <div className="input-with-suffix">
              <input
                id="delay-seconds"
                type="number"
                min="0"
                step="1"
                value={delaySeconds}
                onChange={(event) =>
                  setDelaySeconds(
                    event.target.value,
                  )
                }
              />

              <span>seconds</span>
            </div>

            <span className="field-hint">
              Minimum gap between
              individual sends.
            </span>
          </div>

          <div className="form-field">
            <label htmlFor="hourly-limit">
              Emails Per Hour
            </label>

            <div className="input-with-suffix">
              <input
                id="hourly-limit"
                type="number"
                min="1"
                step="1"
                value={hourlyLimit}
                onChange={(event) =>
                  setHourlyLimit(
                    event.target.value,
                  )
                }
              />

              <span>emails</span>
            </div>

            <span className="field-hint">
              Maximum emails allowed in one
              hour.
            </span>
          </div>
        </div>
      </div>

      <div className="campaign-summary">
        <div>
          <span>Recipients</span>
          <strong>
            {recipients.length}
          </strong>
        </div>

        <div>
          <span>Delay</span>
          <strong>
            {delaySeconds}s
          </strong>
        </div>

        <div>
          <span>Hourly limit</span>
          <strong>
            {hourlyLimit}
          </strong>
        </div>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="primary-button schedule-button"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Clock3
                size={18}
                className="spin"
              />
              Scheduling...
            </>
          ) : (
            <>
              <Clock3 size={18} />
              Schedule Campaign
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default ComposeEmailForm;