const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function readItems() {
    const items = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    return Array.isArray(items) ? items : items.items;
}

async function writeItems(items) {
    await fs.writeFile(DATA_FILE, `${JSON.stringify(items, null, 2)}\n`);
}

function presentItem(item) {
    return { ...item, status: item.claimed ? 'CLAIMED' : 'UNCLAIMED' };
}

app.get('/api/items', async (request, response, next) => {
    try {
        response.json((await readItems()).map(presentItem));
    } catch (error) {
        next(error);
    }
});

app.get('/api/items/:id', async (request, response, next) => {
    try {
        const item = (await readItems()).find((entry) => String(entry.id) === request.params.id);
        if (!item) {
            return response.status(404).json({ error: 'Item not found.' });
        }
        return response.json(presentItem(item));
    } catch (error) {
        return next(error);
    }
});

app.post('/api/items', async (request, response, next) => {
    try {
        const requiredFields = ['item_name', 'category', 'location_found', 'date_found'];
        const invalidFields = requiredFields.filter(
            (field) => typeof request.body?.[field] !== 'string' || !request.body[field].trim(),
        );
        if (invalidFields.length) {
            return response.status(400).json({
                error: 'Required fields are missing or invalid.',
                fields: invalidFields,
            });
        }

        const items = await readItems();
        const nextId = items.reduce((highest, item) => {
            const id = Number(item.id);
            return Number.isInteger(id) ? Math.max(highest, id) : highest;
        }, 0) + 1;
        const newItem = {
            id: nextId,
            item_name: request.body.item_name.trim(),
            category: request.body.category.trim(),
            location_found: request.body.location_found.trim(),
            date_found: request.body.date_found.trim(),
            claimed: false,
        };

        items.push(newItem);
        await writeItems(items);
        return response.status(201).json(presentItem(newItem));
    } catch (error) {
        return next(error);
    }
});

app.delete('/api/items/:id', async (request, response, next) => {
    try {
        const items = await readItems();
        const index = items.findIndex((entry) => String(entry.id) === request.params.id);
        if (index === -1) {
            return response.status(404).json({ error: 'Item not found.' });
        }
        if (items[index].claimed) {
            return response.status(409).json({ error: 'Claimed items cannot be deleted.' });
        }

        const [deletedItem] = items.splice(index, 1);
        await writeItems(items);
        return response.json({ message: 'Item deleted successfully.', item: presentItem(deletedItem) });
    } catch (error) {
        return next(error);
    }
});

app.use('/api', (request, response) => {
    response.status(404).json({ error: 'API route not found.' });
});

app.use((error, request, response, next) => {
    console.error(error);
    if (response.headersSent) {
        return next(error);
    }
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return response.status(400).json({ error: 'Request body must be valid JSON.' });
    }
    return response.status(500).json({ error: 'An internal server error occurred.' });
});

app.listen(PORT, () => {
    console.log(`Lost & Found app listening at http://localhost:${PORT}`);
});
