import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import Button from "@/components/ui/Button";

/**
 * V-Card Configure form (scaffold). Validates input locally; submission is
 * stubbed with a toast because the backend does not yet accept
 * `subtype: "vcard"`. Full wiring lands in a follow-up PRD.
 */
export default function ConfigureVCard() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [touched, setTouched] = useState(false);

  const hasName = firstName.trim().length > 0 || lastName.trim().length > 0;
  const hasContact = phone.trim().length > 0 || email.trim().length > 0;
  const canSubmit = useMemo(() => hasName && hasContact, [hasName, hasContact]);

  const handleSubmit = () => {
    setTouched(true);
    if (!canSubmit) return;
    toast.error(
      "V-Card creation is coming soon — backend pending.",
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900">
          Configure V-Card
        </h3>
        <p className="mt-1 text-xs text-gray-600">
          Enter the contact details — scanning adds them to the scanner's phone.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="First name"
          required
          touched={touched && !hasName}
          value={firstName}
          onChange={setFirstName}
          placeholder="Jane"
          testId="vcard-firstName"
        />
        <Field
          label="Last name"
          value={lastName}
          onChange={setLastName}
          placeholder="Reynolds"
          testId="vcard-lastName"
        />
        <Field
          label="Title"
          value={title}
          onChange={setTitle}
          placeholder="Project Superintendent"
          testId="vcard-title"
        />
        <Field
          label="Company"
          value={company}
          onChange={setCompany}
          placeholder="Taliho Construction"
          testId="vcard-company"
        />
        <Field
          label="Phone"
          value={phone}
          onChange={setPhone}
          placeholder="(555) 555-0123"
          touched={touched && !hasContact}
          testId="vcard-phone"
          errorMessage={
            touched && !hasContact
              ? "Enter a phone or an email."
              : undefined
          }
        />
        <Field
          label="Email"
          value={email}
          onChange={setEmail}
          placeholder="jane@example.com"
          touched={touched && !hasContact}
          testId="vcard-email"
        />
        <div className="md:col-span-2">
          <Field
            label="Website"
            value={website}
            onChange={setWebsite}
            placeholder="https://"
            testId="vcard-website"
          />
        </div>
      </div>

      <p className="text-xs text-gray-500" data-testid="vcard-footer-note">
        At least a name plus a phone or email is required.
      </p>

      <div className="flex items-center gap-2 justify-end pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={handleSubmit}
          data-testid="vcard-create-add-another"
        >
          Create &amp; Add Another
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSubmit}
          data-testid="vcard-create-populate"
        >
          Create &amp; Populate
        </Button>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  touched?: boolean;
  testId: string;
  errorMessage?: string;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  touched,
  testId,
  errorMessage,
}: FieldProps) {
  const showError = Boolean(touched);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && (
          <span className="text-red-500 ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        className={`block w-full rounded-md shadow-sm text-sm focus:border-brand-400 focus:ring-brand-400 ${
          showError
            ? "border-red-400 focus:border-red-400 focus:ring-red-400"
            : "border-gray-300"
        }`}
      />
      {showError && errorMessage && (
        <p className="mt-1 text-xs text-red-600">{errorMessage}</p>
      )}
    </div>
  );
}
