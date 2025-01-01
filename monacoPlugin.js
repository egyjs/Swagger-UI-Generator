import * as monaco from "monaco-editor";

export default function (Alpine) {
    function isXmlString(str) {
        return str.startsWith('<');
    }

    function language(str) {
        if (isXmlString(str)) {
            return 'xml';
        }
        return 'json';
    }

    Alpine.store('monaco',{
        errors: {}
    })

    Alpine.directive('monaco', (el, { expression }, { evaluate }) => {
        let editor;
        let value = evaluate(expression);

        editor = monaco.editor.create(el, {
            value,
            theme: 'vs-dark',
            language: language(value),
            automaticLayout: true // <<== the important part
        });

        editor.onDidChangeModelContent(() => {
            const newValue = editor.getValue();
            evaluate(`${expression} = \`${newValue}\``); // Sync to Alpine state
            // change language based on content
            monaco.editor.setModelLanguage(editor.getModel(), language(newValue));
        });

        // onDidChangeMarkers
        monaco.editor.onDidChangeMarkers(([uri]) => {
            const markers = monaco.editor.getModelMarkers({resource: uri})
            const error = markers.find(marker => marker.severity === monaco.MarkerSeverity.Error);
            if (error) {
                Alpine.store('monaco').errors[el.id] = {
                    message: error.message,
                    line: error.startLineNumber,
                    column: error.startColumn,
                }
            } else {
                delete Alpine.store('monaco').errors[el.id];
            }
        });
    });
}
