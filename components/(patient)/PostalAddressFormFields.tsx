import React from "react";
import { Text, View } from "react-native";
import { PickerField } from "../PickerField";
import { AppTextInput as TextInput } from "../AppTextInput";
import { withIosStandaloneTextInputStyle } from "../../lib/iosInputStyles";
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

  const labelCls = "text-sm text-gray-700 mb-1";
  const inputCls =
    "bg-gray-50 border border-gray-300 rounded-lg p-4 text-base mb-4";
  const resolvedInputStyle = withIosStandaloneTextInputStyle(inputStyle);

  const preview = formatPostalAddressPreview(form);

  return (
    <View>
      <Text className={labelCls} style={labelStyle}>
        Addressee *
      </Text>
      <TextInput
        style={resolvedInputStyle}
        className={inputStyle ? undefined : inputCls}
        placeholder="Full name as on mail"
        value={form.addressee}
        onChangeText={(v) => updateField("addressee", v)}
        editable={editable}
      />

      <Text
        className={labelCls}
        style={[labelStyle, inputStyle ? { marginTop: 8 } : undefined]}
      >
        Address type *
      </Text>
      <View className="mb-4">
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
          <Text className={labelCls} style={labelStyle}>
            PO Box number *
          </Text>
          <TextInput
            style={resolvedInputStyle}
            className={inputStyle ? undefined : inputCls}
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
          <Text className={labelCls} style={labelStyle}>
            Private Bag number *
          </Text>
          <TextInput
            style={resolvedInputStyle}
            className={inputStyle ? undefined : inputCls}
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
          <Text className={labelCls} style={labelStyle}>
            Unit / additional (optional)
          </Text>
          <TextInput
            style={resolvedInputStyle}
            className={inputStyle ? undefined : inputCls}
            placeholder="e.g. Flat 2, Unit B"
            value={form.unitOrAdditional || ""}
            onChangeText={(v) => updateField("unitOrAdditional", v)}
            editable={editable}
          />

          <Text className={labelCls} style={labelStyle}>
            Street / premises *
          </Text>
          <TextInput
            style={resolvedInputStyle}
            className={inputStyle ? undefined : inputCls}
            placeholder="e.g. 11 Mermaid Street"
            value={form.premises || ""}
            onChangeText={(v) => updateField("premises", v)}
            editable={editable}
          />

          <Text className={labelCls} style={labelStyle}>
            Suburb / village (optional)
          </Text>
          <TextInput
            style={resolvedInputStyle}
            className={inputStyle ? undefined : inputCls}
            placeholder="e.g. Ocean View"
            value={form.subLocality || ""}
            onChangeText={(v) => updateField("subLocality", v)}
            editable={editable}
          />

          <Text className={labelCls} style={labelStyle}>
            Locality (optional)
          </Text>
          <TextInput
            style={resolvedInputStyle}
            className={inputStyle ? undefined : inputCls}
            placeholder="e.g. Onethindi"
            value={form.locality || ""}
            onChangeText={(v) => updateField("locality", v)}
            editable={editable}
          />
        </>
      )}

      <Text className={labelCls} style={labelStyle}>
        Delivery post office *
      </Text>
      <TextInput
        style={resolvedInputStyle}
        className={inputStyle ? undefined : inputCls}
        placeholder="e.g. WINDHOEK"
        value={form.postOffice}
        onChangeText={(v) => updateField("postOffice", v)}
        editable={editable}
        autoCapitalize="characters"
      />

      <Text className={labelCls} style={labelStyle}>
        Postcode * (5 digits)
      </Text>
      <TextInput
        style={resolvedInputStyle}
        className={inputStyle ? undefined : inputCls}
        placeholder="e.g. 10005"
        value={form.postcode}
        onChangeText={(v) =>
          updateField("postcode", v.replace(/\D/g, "").slice(0, 5))
        }
        editable={editable}
        keyboardType="number-pad"
        maxLength={5}
      />

      <Text className={labelCls} style={labelStyle}>
        Country
      </Text>
      <TextInput
        style={withIosStandaloneTextInputStyle(
          inputStyle
            ? [inputStyle, { color: "#6B7280" }]
            : undefined,
        )}
        className={
          inputStyle
            ? undefined
            : "bg-gray-100 border border-gray-300 rounded-lg p-4 text-base text-gray-600 mb-4"
        }
        value="NAMIBIA"
        editable={false}
      />

      {showPreview ? (
        <>
          <Text className="text-sm font-semibold text-gray-900 mb-2">
            Preview
          </Text>
          <View className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-2">
            <Text className="text-sm text-gray-800 leading-5">
              {preview || "—"}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}
