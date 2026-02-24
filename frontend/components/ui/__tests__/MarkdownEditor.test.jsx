import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MarkdownEditor from '../MarkdownEditor';

function EditorHarness({ initialValue = '', signal = null, onInserted = () => {} }) {
  const [value, setValue] = useState(initialValue);

  return (
    <div>
      <MarkdownEditor
        value={value}
        onChange={setValue}
        insertSnippetSignal={signal}
        onSnippetInserted={onInserted}
      />
      <pre data-testid="editor-value">{value}</pre>
    </div>
  );
}

describe('MarkdownEditor snippet insertion', () => {
  it('inserts snippet at current cursor position', async () => {
    const onInserted = jest.fn();
    const { rerender } = render(
      <EditorHarness initialValue="AlphaBeta" signal={null} onInserted={onInserted} />
    );

    const textarea = screen.getByRole('textbox');
    fireEvent.focus(textarea);
    textarea.setSelectionRange(5, 5);

    rerender(
      <EditorHarness
        initialValue="AlphaBeta"
        signal={{ id: 'snippet-1', text: '::TEMPLATE::' }}
        onInserted={onInserted}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('editor-value')).toHaveTextContent('Alpha::TEMPLATE::Beta');
    });
    expect(onInserted).toHaveBeenCalledWith('snippet-1');
  });

  it('replaces selected text with snippet', async () => {
    const onInserted = jest.fn();
    const { rerender } = render(
      <EditorHarness initialValue="replace-this" signal={null} onInserted={onInserted} />
    );

    const textarea = screen.getByRole('textbox');
    fireEvent.focus(textarea);
    textarea.setSelectionRange(0, 7);

    rerender(
      <EditorHarness
        initialValue="replace-this"
        signal={{ id: 'snippet-2', text: 'inserted' }}
        onInserted={onInserted}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('editor-value')).toHaveTextContent('inserted-this');
    });
  });

  it('does not apply the same snippet id more than once', async () => {
    const onInserted = jest.fn();
    const { rerender } = render(
      <EditorHarness initialValue="start" signal={null} onInserted={onInserted} />
    );

    const textarea = screen.getByRole('textbox');
    fireEvent.focus(textarea);
    textarea.setSelectionRange(5, 5);

    rerender(
      <EditorHarness
        initialValue="start"
        signal={{ id: 'snippet-repeat', text: '-x-' }}
        onInserted={onInserted}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('editor-value')).toHaveTextContent('start-x-');
    });

    rerender(
      <EditorHarness
        initialValue="start"
        signal={{ id: 'snippet-repeat', text: '-x-' }}
        onInserted={onInserted}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('editor-value')).toHaveTextContent('start-x-');
    });
    expect(onInserted).toHaveBeenCalledTimes(1);
  });
});
