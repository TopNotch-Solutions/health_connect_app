import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PickerField } from "../PickerField";
import { AppTextInput as TextInput } from "../AppTextInput";
import { withIosStandaloneTextInputStyle } from "../../lib/iosInputStyles";
import { AUTH_COLORS } from "../../lib/authScreenTheme";
import {
  formatPostalAddressPreview,
  PostalAddressPayload,
  PostalAddressType,
} from "../../lib/postalAddress";

const ADDRESS_TYPE_ITEMS = [
  { label: "PO Box", value: "po_box" },
  { label: "Private Bag", value: "private_bag" },
  { label: "Street / Physical", value: "street" },
];

type PostalAddressFormFieldsProps = {
  form: PostalAddressPayload;
  onChange: (next: PostalAddressPayload) => void;
  editable?: boolean;
  /** Extra style applied to each text input (profile uses custom input styles) */
  inputStyle?: any;
  showPreview?: boolean;
  labelStyle?: any;
};

export default function PostalAddressFormFields({
  form,
  onChange,
  editable = true,
  inputStyle,
  showPreview = true,
  labelStyle,
}: PostalAddressFormFieldsProps) {
  const updateField = <K extends keyof PostalAddressPayload>(
    key: K,
    value: PostalAddressPayload[K],
  ) => {
    onChange({ ...form, [key]: value });
  };

  const resolvedInputStyle = withIosStandaloneTextInputStyle(
    inputStyle ? [styles.inputFallback, inputStyle] : styles.inputFallback,
  );
  const resolvedLabelStyle = [styles.labelFallback, labelStyle];
  const preview = formatPostalAddressPreview(form);

  return (
    <View>
      <Text style={resolvedLabelStyle}>Full name *</Text>
      <TextInput
        style={resolvedInputStyle}
        placeholder="Full name as on mail"
        value={form.addressee}
        onChangeText={(v) => updateField("addressee", v)}
        editable={editable}
      />

      <Text style={resolvedLabelStyle}>Address type *</Text>
      <View style={styles.pickerWrap}>
        <PickerField
          value={form.addressType}
          onValueChange={(value) =>
            updateField(
              "addressType",
              (value || "po_box") as PostalAddressType,
            )
          }
          placeholder="Select address type"
          items={ADDRESS_TYPE_ITEMS}
          disabled={!editable}
        />
      </View>

      {form.addressType === "po_box" && (
        <>
          <Text style={resolvedLabelStyle}>PO Box number *</Text>
          <TextInput
            style={resolvedInputStyle}
            placeholder="e.g. 999"
            value={form.boxNumber || ""}
            onChangeText={(v) => updateField("boxNumber", v)}
            editable={editable}
            keyboardType="number-pad"
          />
        </>
      )}

      {form.addressType === "private_bag" && (
        <>
          <Text style={resolvedLabelStyle}>Private Bag number *</Text>
          <TextInput
            style={resolvedInputStyle}
            placeholder="e.g. 13678"
            value={form.bagNumber || ""}
            onChangeText={(v) => updateField("bagNumber", v)}
            editable={editable}
            keyboardType="number-pad"
          />
        </>
      )}

      {form.addressType === "street" && (
        <>
          <Text style={resolvedLabelStyle}>Unit / additional (optional)</Text>
          <TextInput
            style={resolvedInputStyle}
            placeholder="e.g. Flat 2, Unit B"
            value={form.unitOrAdditional || ""}
            onChangeText={(v) => updateField("unitOrAdditional", v)}
            editable={editable}
          />

          <Text style={resolvedLabelStyle}>Street / premises *</Text>
          <TextInput
            style={resolvedInputStyle}
            placeholder="e.g. 11 Mermaid Street"
            value={form.premises || ""}
            onChangeText={(v) => updateField("premises", v)}
            editable={editable}
          />

          <Text style={resolvedLabelStyle}>Suburb / village (optional)</Text>
          <TextInput
            style={resolvedInputStyle}
            placeholder="e.g. Ocean View"
            value={form.subLocality || ""}
            onChangeText={(v) => updateField("subLocality", v)}
            editable={editable}
          />

          <Text style={resolvedLabelStyle}>Locality (optional)</Text>
          <TextInput
            style={resolvedInputStyle}
            placeholder="e.g. Onethindi"
            value={form.locality || ""}
            onChangeText={(v) => updateField("locality", v)}
            editable={editable}
          />
        </>
      )}

      <Text style={resolvedLabelStyle}>Delivery post office *</Text>
      <TextInput
        style={resolvedInputStyle}
        placeholder="e.g. WINDHOEK"
        value={form.postOffice}
        onChangeText={(v) => updateField("postOffice", v)}
        editable={editable}
        autoCapitalize="characters"
      />

      <Text style={resolvedLabelStyle}>Postcode * (5 digits)</Text>
      <TextInput
        style={resolvedInputStyle}
        placeholder="e.g. 10005"
        value={form.postcode}
        onChangeText={(v) =>
          updateField("postcode", v.replace(/\D/g, "").slice(0, 5))
        }
        editable={editable}
        keyboardType="number-pad"
        maxLength={5}
      />

      <Text style={resolvedLabelStyle}>Country</Text>
      <TextInput
        style={[
          resolvedInputStyle,
          styles.countryInput,
          inputStyle ? { marginBottom: 16 } : null,
        ]}
        value="NAMIBIA"
        editable={false}
      />

      {showPreview ? (
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Preview</Text>
          <Text style={styles.previewText}>{preview || "—"}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  labelFallback: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: AUTH_COLORS.textDark,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  inputFallback: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingLeft: 18,
    paddingVertical: 14,
    minHeight: 54,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 16,
    backgroundColor: AUTH_COLORS.white,
    borderColor: AUTH_COLORS.inputBorder,
    color: AUTH_COLORS.textDark,
  },
  pickerWrap: {
    marginBottom: 16,
  },
  countryInput: {
    backgroundColor: "#F0FDF4",
    color: AUTH_COLORS.textMuted,
  },
  previewCard: {
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: AUTH_COLORS.green,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  previewText: {
    fontSize: 14,
    lineHeight: 21,
    color: AUTH_COLORS.textDark,
  },
});
