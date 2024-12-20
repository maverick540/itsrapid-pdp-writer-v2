<script>
  import 'bootstrap/dist/css/bootstrap.css';
  import { onMount } from 'svelte';
  import * as XLSX from 'xlsx';
  import OpenAI from 'openai';
  import LoadingOverlay from './LoadingOverlay.svelte';
  import SvelteMarkdown from 'svelte-markdown'

  const client = new OpenAI({
    apiKey: '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',
    dangerouslyAllowBrowser: true
  });

  const defaultPrompt = `Optimize the following table of product descriptions:

%InputFileTable%

The list of optimized product descriptions must be in form of a table with the following headers: %Headers%.
The product code must be exactly the same as in the "SKU (or Item / Product ID number)" header in the original table of product descriptions.
The product description in the new table must be in the same order.

Your output must only contain the optimized table of product descriptions. Optimize the product description for the following retailer rules:

%RetailerRules%

In the optimized product descriptions, maximise the use of the following keywords: %Keywords%
In the optimized product descriptions, add bold style to keywords.

In the optimized product descriptions, exclude the following words: %ExcludedWords%`;
  const retailerRules = [
    {
      id: 1,
      name: 'AMZ-Guidelines-Moen',
      promptPart: `Title:
Formula: Brand, Model #, Model Name (Collection), Item Type Name, *Size, *Color, Unit Count, Unit Type 
Example: Moen S73104BL Weymouth One Handle Pre-Rinse Spring Pulldown Kitchen Faucet with Power Boost, Matte Black
Details:
- Keep the product name within 200 characters including spaces.
- Use Title Case to capitalize the first letter of each word (if in English). Convert all words in upper case to lower case.
- Remove duplicate information.
- Use numerals instead of spelling out numbers.
- Add specific information such as the brand, color, and size, especially to any child variations
- Write titles in accordance to ATS's predefined title rule
Prohibited:
- Characters and extra punctuation characters, such as ™~ ! * $ ? _ ~ { } # < > | * ; ^ Æ © ®
- Restricted phrases such as 100% Genuine, Premium Quality, Free 2-Day Shipping
- Unnecessary synonyms, search keywords, or irrelevant keywords that are not related to the product
Disabled

Product Description:
- Min 150 words. 
- Max 200 words.
- Strive to reach the upper max word limit to make the description longer.
- Write in complete sentences and use a full stop at the end
- Use sentence case: Capital letters are only used at the start of a sentence (except for acronyms, such as HDMI, BMX, or USB, which are uppercase)
Prohibited:
- Avoid special characters such as ™, ®, €, …, †, ‡, o, ¢, £, ¥, ©, ±, ~, â, which are not allowed
- Do not include an ASIN number or use "not applicable" or "NA" or "n/a"
- Do not have any spelling or grammatical errors
- Do not use prohibited phrases such as eco-friendly, environmentally friendly, ecologically friendly, anti-microbial, anti-bacterial, Made from Bamboo, contains Bamboo, Made from Soy or contains Soy
- Do not include Amazon.com (or any other extension such as .co.uk or .de) or Amazon
- Don't use prohibited guarantee information such as “Full refund” or “If not satisfied, send it back” or “Unconditional guarantee with no limit”
- Do not include any information related to the cost or price of the product
- Do not include any information related to the company of the vendor
- Do not include any website links

Bullets:
Formula: HEADLINE: Sentence
Example: BOOSTED STREAM: Moen's exclusive Power Boost technology offers a faster clean and faster fill with the push of a button
Details:
- Keep the new bullet list items in the same order as the original product description.
- Begin with a capital letter
- Format bullets as a sentence fragment
- Use a semicolon (;) to separate phrases within a single bullet point
- Use a minimum of 10 characters per bullet and maximum of 255 characters per bullet
- Write numbers one through nine in full, excluding names, model numbers, and measurements
- Add a header, ending with a colon (:)
- Include a space between a digit and a measurement, for example, 60 ml (not 60ml)
- Use clear, natural language; avoid adding unnecessary keywords or phrases
- Highlight product features and benefits; avoid marketing copy
- Highlight how the product meets the customer needs
- Maintain data consistency across product variants
Prohibited
- Special characters such as ™, ®, €, …, †, ‡, o, ¢, £, ¥, ©, ±, ~, â
- Emojis
- ASIN number, "not applicable", "NA", "n/a", "N/A", "not eligible", "yet to decide", "to be decided", "TBD", or "COPY PENDING"
- Prohibited phrases such as "eco-friendly", "environmentally friendly", "ecologically friendly", "anti-microbial", "anti-bacterial", "made from bamboo", "contains bamboo", "made from Soy", or "contains Soy". For more information, go to Prohibited Product Claims
- Prohibited guarantee information such as "Full refund", "If not satisfied, send it back", or "Unconditional guarantee with no limit"
- Company information, website links, external hyperlinks, or contact information
- Do not repeat content; Each bullet point should mention unique product information
- Do not use end punctuation
- Comparison to competitor brands
- Subjective, performance, or comparative claims, unless they are verifiable on the product packaging
- Claims relating to accolades and awards, unless the product detail page contains supporting details, such as date and awarding body
- Claims about the results of consumer surveys, even if the survey collected subjective opinions, unless substantiated with the source and date`
    }
  ];

  let jobs = [];
  let selectedJobIndex = '';
  let selectedJobTableHistoryCompareIndex = '';
  let showNewJobModal = false;
  let showFeedbackModal = false;
  let newJob = {
    file: null,
    name: '',
    headers: '',
    headerMappings: {},
    prompt: '',
    retailerRules: '',
    keywords: '',
    excludedWords: ''
  };
  let feedback = '';
  let overlayVisible = false;

  let xlsxHeaders = [];
  let xlsxRows = [];

  $: selectedJob = selectedJobIndex !== '' ? jobs[selectedJobIndex] : null;
  $: selectedJobTableHistory = (selectedJobIndex !== '' && selectedJobTableHistoryCompareIndex !== '') ? jobs[selectedJobIndex].tableHistory[selectedJobTableHistoryCompareIndex].tableData : null;

  let checkedProducts = new Set();

  onMount(() => {
    const jobsJson = localStorage.getItem('jobs');
    if (jobsJson) {
      jobs = JSON.parse(jobsJson);
      console.log(jobs);
    }
  });

  function showLoadingOverlay() {
    overlayVisible = true;
  }

  function hideLoadingOverlay() {
    overlayVisible = false;
  }

  function generateMarkdownTable(data) {
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Input must be a non-empty array of arrays.");
    }

    const headers = data[0];
    const rows = data.slice(1);

    // Create the header row
    const headerRow = `| ${headers.join(' | ')} |`;

    /*
    // Create the separator row
    const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
    */

    // Create the data rows
    const dataRows = rows.map(row => `| ${row.map(row => `"${row}"`).join(' | ')} |`);

    // Combine all parts into the final markdown table
    // const markdownTable = [headerRow, separatorRow, ...dataRows].join('\n');
    const markdownTable = [headerRow, ...dataRows].join('\n');

    return markdownTable;
  }

  function parseMarkdownTable(markdown) {
    if (typeof markdown !== 'string' || markdown.trim() === '') {
        throw new Error("Input must be a non-empty string.");
    }

    // Split the markdown into lines
    const lines = markdown.trim().split('\n');

    console.log('lines:');
    console.log(lines);

    // Variables to keep track of the table's location
    let tableStart = -1;
    let tableEnd = -1;

    // Find the start and end lines of the table
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (tableStart == -1) {
          tableStart = i;
        }
        tableEnd = i;
      }
    }

    console.log(`tableStart:`);
    console.log(tableStart);
    console.log(`tableEnd:`);
    console.log(tableEnd);

    // If no table is found, return an empty array or handle as needed
    if (tableStart === -1 || tableEnd === -1) {
        throw new Error("No valid markdown table found.");
    }

    // Extract the table lines
    const tableLines = lines.slice(tableStart, tableEnd);

    // Remove the separator line (second line)
    const dataLines = [tableLines[0], ...tableLines.slice(2)];

    // Function to split a line into cells, considering quotes
    function splitLine(line) {
        const cells = [];
        let currentCell = '';
        let insideQuotes = false;

        // Remove leading and trailing pipe characters
        line = line.trim();
        if (line.startsWith('|')) line = line.slice(1);
        if (line.endsWith('|')) line = line.slice(0, -1);

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
                // Toggle the insideQuotes flag when encountering an unescaped quote
                insideQuotes = !insideQuotes;
            } else if (char === '|' && !insideQuotes) {
                // If we encounter a pipe and we're not inside quotes, it's a cell separator
                cells.push(currentCell.trim());
                currentCell = '';
            } else {
                // Otherwise, add the character to the current cell
                currentCell += char;
            }
        }

        // Add the last cell
        cells.push(currentCell.trim());

        return cells;
    }

    // Parse each line into cells
    return dataLines.map(splitLine);
  }

  function toggleProductCheck(productIndex) {
    if (checkedProducts.has(productIndex)) {
      checkedProducts.delete(productIndex);
    } else {
      checkedProducts.add(productIndex);
    }
    checkedProducts = checkedProducts;
  }

  function openNewJobModal() {
    resetNewJob();
    showNewJobModal = true;
  }

  function closeNewJobModal() {
    resetNewJob();
    showNewJobModal = false;
  }

  function openFeedbackModal() {
    showFeedbackModal = true;
  }

  function closeFeedbackModal() {
    showFeedbackModal = false;
  }

  function resetNewJob() {
    newJob = {
      file: null,
      name: '',
      headers: 'Product_Code, Product_Name, Long_Product_Copy, Extended_Bullet_1, Extended_Bullet_2, Extended_Bullet_3, Extended_Bullet_4, Extended_Bullet_5',
      headerMappings: {},
      prompt: defaultPrompt,
      retailerRules: '',
      keywords: 'sensitive stomachs, reduce colic, reduce spit up, fussiness, gassy, soy baby formula, cows milk allergy, lactose free, hypoallergenic, plant-based, lactose intolerance, Mederma, scar, scars, scar gel, acne, scar treatment, surgery, wound, whitening products, holidays, whitening, whitening pen, whitening kit, holiday smile, whiter teeth, whiter smile',
      excludedWords: 'prevents, cures, organic, whitening strips'
    };
    updateHeaderMappings();
    newJob.headerMappings.find((mapping) => mapping.header === 'Product_Code').value = 0;
    newJob.headerMappings.find((mapping) => mapping.header === 'Product_Name').value = 1;
    newJob.headerMappings.find((mapping) => mapping.header === 'Long_Product_Copy').value = 2;
    newJob.headerMappings.find((mapping) => mapping.header === 'Extended_Bullet_1').value = 5;
    newJob.headerMappings.find((mapping) => mapping.header === 'Extended_Bullet_2').value = 6;
    newJob.headerMappings.find((mapping) => mapping.header === 'Extended_Bullet_3').value = 7;
    newJob.headerMappings.find((mapping) => mapping.header === 'Extended_Bullet_4').value = 8;
    newJob.headerMappings.find((mapping) => mapping.header === 'Extended_Bullet_5').value = 9;
    newJob = newJob;
  }

  function updateHeaderMappings() {
    newJob.headerMappings = newJob.headers.split(',').map((header) => {
      return {
        header: header.trim(),
        value: ''
      };
    })
  }

  function getCurrentDateAsString() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const seconds = String(currentDate.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  function transformString(str) {
    // Convert the string to lowercase
    let lowerStr = str.toLowerCase();
    // Replace spaces and special characters with underscores
    let transformedStr = lowerStr.replace(/[\s\W]+/g, '_');
    return transformedStr;
  }

  async function runJob() {
    showLoadingOverlay();
    const retailerRuleId = newJob.retailerRules;
    const retailerRule = retailerRules.filter((_retailerRule) => _retailerRule.id === retailerRuleId)[0];

    const originalTableHeaders = newJob.headers.split(',').map((header) => header.trim());
    const originalTableData = [
      originalTableHeaders,
      ...xlsxRows.map((row) => {
        return originalTableHeaders.map((tableHeader) => {
          console.log(`tableHeader: ${tableHeader}`)
          const mapping = newJob.headerMappings.find((_mapping) => {
            console.log(_mapping);
            return _mapping.header === tableHeader;
          })
          console.log('----');
          console.log(mapping);
          return row[mapping.value];
        })
      })
    ];
    console.log('originalTableData:');
    console.log(originalTableData);
    const originalDataMarkdownTable = generateMarkdownTable(originalTableData);
    let fullPrompt = newJob.prompt;
    fullPrompt = fullPrompt
      .replaceAll('%InputFileTable%', originalDataMarkdownTable)
      .replaceAll('%Headers%', originalTableHeaders.map((header) => `"${header}"`).join(', '))
      .replaceAll('%RetailerRules%', retailerRule ? retailerRule.promptPart : '')
      .replaceAll('%Keywords%', newJob.keywords)
      .replaceAll('%ExcludedWords%', newJob.excludedWords);
    console.log('fullPrompt:');
    console.log(fullPrompt);
    let messages = [{ role: 'user', content: fullPrompt }];
    const chatCompletion = await client.chat.completions.create({
      messages: messages,
      model: 'gpt-4o'
    });
    messages.push(chatCompletion.choices[0].message);
    const chatGPTResponseContent = chatCompletion.choices[0].message.content;
    const tableData = parseMarkdownTable(chatGPTResponseContent);
    jobs.push({
      name: newJob.name.split('.')[0],
      formData: newJob,
      fullPrompt: fullPrompt,
      tableData: tableData,
      messageHistory: messages,
      tableHistory: [
        {
          name: 'Original',
          string: originalDataMarkdownTable,
          tableData: originalTableData
        }
      ]
    });
    jobs = jobs;
    selectedJobIndex = jobs.length - 1;
    localStorage.setItem('jobs', JSON.stringify(jobs));
    closeNewJobModal();
    hideLoadingOverlay();
  }

  async function submitFeedback() {
    showLoadingOverlay();
    let messages = jobs[selectedJobIndex].messageHistory;
    let fullPrompt = feedback;
    console.log('fullPrompt:');
    console.log(fullPrompt);
    /*
    fullPrompt = fullPrompt
      .replaceAll('%InputFileTable%', originalDataMarkdownTable);
    */
    messages.push({
      role: 'user',
      content: fullPrompt
    });
    const chatCompletion = await client.chat.completions.create({
      messages: messages,
      model: 'gpt-4o'
    });
    const chatGPTResponseContent = chatCompletion.choices[0].message.content;
    const tableData = parseMarkdownTable(chatGPTResponseContent);
    jobs[selectedJobIndex].messageHistory = messages;
    jobs[selectedJobIndex].tableHistory.push({
      name: getCurrentDateAsString(),
      string: generateMarkdownTable(jobs[selectedJobIndex].tableData),
      tableData: jobs[selectedJobIndex].tableData
    });
    jobs[selectedJobIndex].tableData = tableData;
    jobs = jobs;
    localStorage.setItem('jobs', JSON.stringify(jobs));
    closeFeedbackModal();
    hideLoadingOverlay();
  }

  function handleFileInput(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      const data = e.target.result;
      newJob.name = file.name;
      xlsxHeaders = [];
      xlsxRows = [];
      if (file.type === 'text/csv') {
        xlsxRows = data.split('\n').map((row) => row.split(','));
        xlsxHeaders = xlsxRows[0];
        xlsxRows.shift();
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        xlsxRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }).filter(row => row.length > 0);
        xlsxHeaders = xlsxRows[0];
        xlsxRows.shift();
      }
    };

    if (file.type === 'text/csv') {
      reader.readAsText(file);
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      reader.readAsBinaryString(file);
    }
  }
</script>

<!-- svelte-ignore css_unused_selector -->
<style>
  .table :global(strong) {
    background-color: yellow;
  }

  /* Override Bootstrap primary button styles */
  .btn-primary {
    background-color: #197c6b;
    border-color: #197c6b;
  }

  /* Optional: Change hover and active states */
  .btn-primary:hover,
  .btn-primary:focus,
  .btn-primary:active {
    background-color: #166a5e;
    border-color: #166a5e;
  }

  .btn-primary:active {
    background-color: #145c53;
    border-color: #145c53;
  }
</style>

<div class="container my-5">
  <h1>Product Description Generator V2</h1>

  <div class="mt-3 mb-3">
    <button class="btn btn-primary" on:click={openNewJobModal}>New Job</button>
  </div>

  <div class="form-group">
    <label for="jobSelect">Jobs</label>
    <select id="jobSelect" class="form-control" bind:value={selectedJobIndex}>
      <option value="" selected>Select a job</option>
      {#each jobs as job, jobIndex}
        <option value={jobIndex}>{job.name}</option>
      {/each}
    </select>
  </div>

  {#if selectedJob}
    <div class="form-group mt-2">
      <label for="jobSelect">Compare with</label>
      <select id="jobSelect" class="form-control" bind:value={selectedJobTableHistoryCompareIndex}>
        <option value="" selected>Select a previous version to compare with</option>
        {#each selectedJob.tableHistory as history, historyIndex}
          <option value={historyIndex}>{history.name}</option>
        {/each}
      </select>
    </div>
    <div class="table-responsive">
      <table class="table table-striped mt-4">
        <thead>
          <tr>
            <!--
            <th></th>
            -->
            {#each selectedJob.tableData[0] as header, index}
              <th style="min-width: 320px;">{header}</th>
              {#if selectedJobTableHistory}
                <th style="min-width: 320px;">Original_{header}</th>
              {/if}
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each selectedJob.tableData as row, rowIndex}
            {#if rowIndex > 0}
              <tr>
                <!--
                <td>
                  <input type="checkbox" on:change={() => toggleProductCheck(index)} />
                </td>
                -->
                {#each row as cell, cellIndex}
                  <td><SvelteMarkdown source={cell}/></td>
                  {#if selectedJobTableHistory}
                    <td><SvelteMarkdown source={selectedJobTableHistory[rowIndex][cellIndex]}/></td>
                  {/if}
                {/each}
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
    <div class="mt-4">
      <button class="btn btn-primary" on:click={openFeedbackModal} disabled={false/* checkedProducts.size === 0*/}>Feedback</button>
    </div>
  {/if}

  <!-- New Job Modal -->
  {#if showNewJobModal}
    <div class="modal show" tabindex="-1" style="display: block;">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">New Job</h5>
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button type="button" class="btn-close" on:click={closeNewJobModal}></button>
          </div>
          <div class="modal-body">
            <form>
              <div class="form-group mb-3">
                <label for="fileInput">File</label>
                <input type="file" id="fileInput" class="form-control" accept=".csv, .xlsx" on:change={handleFileInput} />
              </div>
              <div class="form-group mb-3">
                <label for="nameInput">Name</label>
                <input type="text" id="nameInput" class="form-control" bind:value={newJob.name} />
              </div>
              <div class="form-group mb-3">
                <label for="headersInput">Headers</label>
                <input type="text" id="headersInput" class="form-control" bind:value={newJob.headers} />
              </div>
              <div class="card mb-3">
                <div class="card-body">
                  <h6 class="card-title">Header Mappings</h6>
                  {#each newJob.headerMappings as headerMapping}
                    <div class="form-group mb-3">
                      <label for="{`headersInput_${transformString(headerMapping.header)}`}">{headerMapping.header}</label>
                      <select id="{`headersInput_${transformString(headerMapping.header)}`}" class="form-control" bind:value={headerMapping.value}>
                        <option value="">Select a column</option>
                        {#each xlsxHeaders as _xlxsHeader, _xlxsHeaderIndex}
                          <option value="{_xlxsHeaderIndex}">{_xlxsHeader}</option>
                        {/each}
                      </select>
                    </div>
                  {/each}
                </div>
              </div>
              <div class="form-group mb-3">
                <label for="promptInput">Prompt</label>
                <textarea id="promptInput" class="form-control" rows="20" bind:value={newJob.prompt}></textarea>
              </div>
              <div class="form-group mb-3">
                <label for="retailerRulesSelect">Retailer Rules</label>
                <select id="retailerRulesSelect" class="form-control" bind:value={newJob.retailerRules}>
                  <option value="" selecteed>Select a Retailer Rule...</option>
                  {#each retailerRules as retailerRule}
                    <option value="{retailerRule.id}">{retailerRule.name}</option>
                  {/each}
                </select>
              </div>
              <div class="form-group mb-3">
                <label for="keywordsInput">Keywords</label>
                <input type="text" id="keywordsInput" class="form-control" bind:value={newJob.keywords} />
              </div>
              <div class="form-group mb-3">
                <label for="excludedWordsInput">Excluded Words</label>
                <input type="text" id="excludedWordsInput" class="form-control" bind:value={newJob.excludedWords} />
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" on:click={runJob}>Run</button>
            <button type="button" class="btn btn-secondary" on:click={closeNewJobModal}>Close</button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Feedback Modal -->
  {#if showFeedbackModal}
    <div class="modal show" tabindex="-1" style="display: block;">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Send Feedback</h5>
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button type="button" class="btn-close" on:click={closeFeedbackModal}></button>
          </div>
          <div class="modal-body">
            <div class="form-group mb-3">
              <label for="feedbackInput">Feedback</label>
              <textarea id="feedbackInput" class="form-control" rows="8" bind:value={feedback}></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" on:click={submitFeedback}>Submit</button>
            <button type="button" class="btn btn-secondary" on:click={closeFeedbackModal}>Close</button>
          </div>
        </div>
      </div>
    </div>
  {/if}
  <LoadingOverlay visible={overlayVisible} />
</div>