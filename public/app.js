const itemsList = document.querySelector('#items-list');
const message = document.querySelector('#message');
const searchForm = document.querySelector('#search-form');
const addForm = document.querySelector('#add-form');
let showingOneItem = false;

async function apiRequest(url, options = {}) {
    const response = await fetch(url, options);
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || `Request failed (${response.status}).`);
    }
    return result;
}

function setMessage(text, isError = false) {
    message.textContent = text;
    message.style.fontWeight = isError ? 'bold' : 'normal';
}

function addField(container, label, value) {
    const row = document.createElement('p');
    row.textContent = `${label}: ${value}`;
    container.append(row);
}

function renderItems(items) {
    itemsList.replaceChildren();

    if (!items.length) {
        itemsList.textContent = 'No items found.';
        return;
    }

    for (const item of items) {
        const row = document.createElement('article');
        row.className = 'item-row';
        addField(row, 'ID', item.id);
        addField(row, 'Item', item.item_name);
        addField(row, 'Category', item.category);
        addField(row, 'Location found', item.location_found);
        addField(row, 'Date found', item.date_found);
        const status = document.createElement('p');
        status.className = 'item-status';
        status.textContent = item.claimed ? 'CLAIMED' : 'UNCLAIMED';
        row.append(status);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'delete-button';
        deleteButton.textContent = item.claimed ? 'Cannot delete claimed item' : 'Delete item';
        deleteButton.disabled = item.claimed;
        if (!item.claimed) {
            deleteButton.addEventListener('click', () => deleteItem(item.id));
        }
        row.append(deleteButton);
        itemsList.append(row);
    }
}

async function loadItems() {
    try {
        showingOneItem = false;
        const items = await apiRequest('/api/items');
        renderItems(items);
        setMessage(`Loaded ${items.length} item${items.length === 1 ? '' : 's'}.`);
    } catch (error) {
        setMessage(error.message, true);
    }
}

async function searchItem(id) {
    try {
        const item = await apiRequest(`/api/items/${encodeURIComponent(id)}`);
        showingOneItem = true;
        renderItems([item]);
        setMessage(`Showing item ${item.id}.`);
    } catch (error) {
        showingOneItem = true;
        renderItems([]);
        setMessage(error.message, true);
    }
}

async function deleteItem(id) {
    if (!window.confirm(`Delete unclaimed item ${id}?`)) {
        return;
    }

    try {
        const result = await apiRequest(`/api/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
        setMessage(result.message);
        if (showingOneItem) {
            const searchId = document.querySelector('#search-id').value;
            await searchItem(searchId);
        } else {
            await loadItems();
        }
    } catch (error) {
        setMessage(error.message, true);
    }
}

searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = new FormData(searchForm).get('id');
    if (!id) {
        setMessage('Enter an item ID to search.', true);
        return;
    }
    await searchItem(id);
});

document.querySelector('#show-all').addEventListener('click', loadItems);

addForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const itemFields = Object.fromEntries(new FormData(addForm).entries());

    try {
        const created = await apiRequest('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemFields),
        });
        addForm.reset();
        setMessage(`Added item ${created.id}: ${created.item_name} (UNCLAIMED).`);
        await loadItems();
    } catch (error) {
        setMessage(error.message, true);
    }
});

loadItems();
