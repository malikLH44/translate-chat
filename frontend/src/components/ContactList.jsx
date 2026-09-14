function ContactList({ contacts, selectedId, onSelect }) {
  return (
    <div className="w-72 border-r border-border h-screen overflow-y-auto bg-surface">
      <div className="p-4 border-b border-border">
        <h2 className="font-display text-lg font-semibold text-text">Contacts</h2>
      </div>
      <ul>
        {contacts.map((contact) => (
          <li key={contact.id}>
            <button
              onClick={() => onSelect(contact)}
              className={`w-full text-left px-4 py-3 flex items-center justify-between border-b border-border hover:bg-bg transition-colors ${
                selectedId === contact.id ? 'bg-sky-soft/30' : ''
              }`}
            >
              <span className="text-text font-medium">{contact.email}</span>
              <span className="text-xs font-medium text-sky-strong bg-sky-soft px-2 py-0.5 rounded">
                {contact.preferred_language.toUpperCase()}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {contacts.length === 0 && (
        <p className="text-text-muted text-sm p-4">Aucun autre utilisateur inscrit pour l'instant.</p>
      )}
    </div>
  );
}

export default ContactList;