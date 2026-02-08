'use client';

import { Editor } from '@monaco-editor/react';
import { Card } from '@/components/ui/card';

interface SQLEditorProps {
  value: string;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
  height?: string;
}

export function SQLEditor({ value, onChange, readOnly = false, height = '200px' }: SQLEditorProps) {
  return (
    <Card className="overflow-hidden">
      <Editor
        height={height}
        defaultLanguage="sql"
        value={value}
        onChange={onChange}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          theme: 'vs-light',
        }}
      />
    </Card>
  );
}
