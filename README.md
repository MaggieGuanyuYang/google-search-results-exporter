# Google Search Results Exporter

A simple Chrome extension that exports Google search results to a CSV file.

## Features

- Export search results from any Google search page with one click
- Captures title, URL, snippet, and position for each result
- Identifies sponsored/ad results
- Downloads as a clean CSV file
- Works with google.com and google.co.uk

## Installation

Since this extension is not on the Chrome Web Store, you'll need to install it manually:

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked**
5. Select the folder containing this extension

## Usage

1. Go to Google and perform a search
2. Click the extension icon in your toolbar
3. Click **Export to CSV**
4. Choose where to save the file

The CSV will contain:
| Column | Description |
|--------|-------------|
| Position | Page and result ranking (e.g., 1.1, 1.2 for page 1; 2.1, 2.2 for page 2) |
| Title | The clickable title of the result |
| URL | The destination URL |
| Snippet | The description text shown below the title |
| Sponsored | Whether the result is an ad (Yes/No) |

## Example Output

```csv
Position,Title,URL,Snippet,Sponsored
1.1,"Example Website","https://example.com","This is the description text...","No"
1.2,"Another Result","https://another.com","More description here...","No"
```

For page 2 results:
```csv
Position,Title,URL,Snippet,Sponsored
2.1,"Page Two Result","https://example2.com","Description...","No"
2.2,"Another Page Two","https://another2.com","More text...","No"
```

## Permissions

This extension requires minimal permissions:
- `activeTab` - To read the current Google search page
- `scripting` - To extract search results from the page
- `downloads` - To save the CSV file

## Privacy

- No data is collected or sent anywhere
- All processing happens locally in your browser
- The extension only activates on Google search pages

## License

MIT License - see [LICENSE](LICENSE) for details.
