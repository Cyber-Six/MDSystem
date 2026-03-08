const docxBase64 = '{{docx_base64}}';

async function loadDocxPreview() {
    try {
        document.getElementById("loading").style.display = "block";
        const docxBytes = Uint8Array.from(atob(docxBase64), c => c.charCodeAt(0));
        const result = await mammoth.convertToHtml({{ arrayBuffer: docxBytes.buffer }});
        
        const preview = document.getElementById("docxPreview");
        preview.innerHTML = result.value;
        preview.style.fontSize = "14px";
        preview.style.color = "#333";
    }} catch (error) {{
        document.getElementById("error").textContent = "Error loading preview: " + error.message;
        document.getElementById("error").style.display = "block";
    }} finally {{
        document.getElementById("loading").style.display = "none";
    }}
}}

function downloadDocx() {{
    const link = document.createElement("a");
    link.href = "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64," + docxBase64;
    link.download = "generated_{{safe_name}}.docx";
    link.click();
}}

loadDocxPreview();
