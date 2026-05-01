import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/modal/Modal";
import {
  useNotifyCompanyAdmins,
  type NotifyAdminsParams,
} from "@/api/endpoints/admin-customers";
import toast from "react-hot-toast";

type EmailTemplate = "procore_disconnection" | "trial_expiring" | "custom";

interface TemplateContent {
  subject: string;
  body: string;
}

const EMAIL_TEMPLATES: Record<EmailTemplate, TemplateContent> = {
  procore_disconnection: {
    subject: "Action Required: Procore Integration Disconnected",
    body: `We noticed that your Procore integration has been disconnected from your Taliho account.

This may have happened for one of the following reasons:
- Your Procore access token has expired
- Your Procore permissions have changed
- The integration was manually disconnected

To reconnect your Procore account and restore full functionality, please log in to your Taliho dashboard and navigate to Settings > Integrations > Procore.

If you need any assistance, please don't hesitate to reach out to our support team.`,
  },
  trial_expiring: {
    subject: "Your Taliho Free Trial is Ending Soon",
    body: `Your Taliho free trial is expiring soon. To continue using all features without interruption, please upgrade to a paid plan.

Benefits of upgrading:
- Unlimited QR codes and projects
- Advanced Procore integration
- Priority support
- And much more!

Visit your dashboard to view pricing and upgrade your account today.`,
  },
  custom: {
    subject: "",
    body: "",
  },
};

type AdminEmailModalProps = {
  open: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
  defaultTemplate?: EmailTemplate;
};

export default function AdminEmailModal({
  open,
  onClose,
  companyId,
  companyName,
  defaultTemplate = "procore_disconnection",
}: AdminEmailModalProps) {
  const [selectedTemplate, setSelectedTemplate] =
    useState<EmailTemplate>(defaultTemplate);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const notifyMutation = useNotifyCompanyAdmins();

  // Update subject and body when template changes
  useEffect(() => {
    const template = EMAIL_TEMPLATES[selectedTemplate];
    setSubject(template.subject);
    setBody(template.body);
  }, [selectedTemplate]);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setSelectedTemplate(defaultTemplate);
      const template = EMAIL_TEMPLATES[defaultTemplate];
      setSubject(template.subject);
      setBody(template.body);
    }
  }, [open, defaultTemplate]);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and body are required");
      return;
    }

    const params: NotifyAdminsParams = {
      subject: subject.trim(),
      body: body.trim(),
      template: selectedTemplate,
    };

    notifyMutation.mutate(
      { companyId, params },
      {
        onSuccess: (data) => {
          toast.success(`Email sent to ${data.sentCount} admin(s)`);
          onClose();
        },
        onError: (err: unknown) => {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to send email";
          const axiosError = err as {
            response?: { data?: { message?: string } };
          };
          toast.error(axiosError?.response?.data?.message || errorMessage);
        },
      },
    );
  };

  const canSend = subject.trim() && body.trim() && !notifyMutation.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send Email to Company Admins"
      subtitle={`Send a notification email to all admins of ${companyName}`}
      size="xl"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={notifyMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            leftIconClass={
              notifyMutation.isPending
                ? "bx bx-loader-alt bx-spin"
                : "bx bx-send"
            }
            disabled={!canSend}
            onClick={handleSend}
          >
            {notifyMutation.isPending ? "Sending..." : "Send Email"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Template Selector */}
        <div>
          <label
            htmlFor="template"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email Template
          </label>
          <select
            id="template"
            value={selectedTemplate}
            onChange={(e) =>
              setSelectedTemplate(e.target.value as EmailTemplate)
            }
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="procore_disconnection">
              Procore Disconnection Notice
            </option>
            <option value="trial_expiring">Trial Expiring Notice</option>
            <option value="custom">Custom Message</option>
          </select>
        </div>

        {/* Subject */}
        <div>
          <label
            htmlFor="subject"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Subject
          </label>
          <input
            type="text"
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Enter email subject..."
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        {/* Body */}
        <div>
          <label
            htmlFor="body"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Message Body
          </label>
          <textarea
            id="body"
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Enter email message..."
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Line breaks will be preserved in the email.
          </p>
        </div>

        {/* Preview Info */}
        <div className="bg-gray-50 rounded-md p-3">
          <p className="text-xs text-gray-500">
            <i className="bx bx-info-circle mr-1"></i>
            This email will be sent to all users with admin permission in{" "}
            <strong>{companyName}</strong>. The email will include a branded
            Taliho template with your message.
          </p>
        </div>
      </div>
    </Modal>
  );
}
