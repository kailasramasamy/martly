import { Button, Card, Form, Input, Select, Space, Switch } from "antd";
import { MinusCircleOutlined, PlusOutlined, TranslationOutlined } from "@ant-design/icons";
import { GLOSSARY_LANGUAGES } from "@martly/shared/constants";
import { sectionTitle } from "../../theme";

export const languageOptions = Object.entries(GLOSSARY_LANGUAGES).map(([value, label]) => ({ value, label }));

const PhraseRows = () => (
  <Form.List name="phrases" rules={[{ validator: async (_, rows) => { if (!rows?.length) throw new Error("Add at least one phrase"); } }]}>
    {(fields, { add, remove }, { errors }) => (
      <>
        {fields.map(({ key, name }) => (
          <Space key={key} align="start" style={{ display: "flex" }}>
            <Form.Item name={[name, "language"]} rules={[{ required: true, message: "Pick a language" }]}>
              <Select options={languageOptions} placeholder="Language" style={{ width: 130 }} />
            </Form.Item>
            <Form.Item
              name={[name, "text"]}
              rules={[{ required: true, whitespace: true, message: "Enter the phrase" }, { max: 80 }]}
            >
              <Input placeholder="Native script or romanised" style={{ width: 320 }} />
            </Form.Item>
            <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
          </Space>
        ))}
        <Form.ErrorList errors={errors} />
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          disabled={fields.length >= 30}
          onClick={() => add({ language: "ta" })}
        >
          Add phrase
        </Button>
      </>
    )}
  </Form.List>
);

export const GlossaryFields = () => (
  <Card title={sectionTitle(<TranslationOutlined />, "Glossary Term")} size="small">
    <Form.Item
      label="Catalog word"
      name="searchTerm"
      extra="The word products are listed under, e.g. besan"
      rules={[{ required: true, whitespace: true }, { max: 60 }]}
    >
      <Input />
    </Form.Item>
    <Form.Item
      label="Note"
      name="note"
      extra="Anything shopping lists should know, e.g. raw gram flour, never roasted"
      rules={[{ max: 120 }]}
    >
      <Input />
    </Form.Item>
    <Form.Item label="Active" name="isActive" valuePropName="checked">
      <Switch />
    </Form.Item>
    <Form.Item label="Phrases" required extra="Ways shoppers say it, in each language">
      <PhraseRows />
    </Form.Item>
  </Card>
);
