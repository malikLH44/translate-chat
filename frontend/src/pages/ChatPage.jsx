import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { authApi, gatewayApi } from '../lib/api';
import { loadSession, clearSession } from '../lib/auth';
import { getSocket, disconnectSocket } from '../lib/socket';
import ContactList from '../components/ContactList';
import MessageBubble from '../components/MessageBubble';

function ChatPage() {
  const session = loadSession();
  const navigate = useNavigate();
  const { contactId } = useParams();

  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const bottomRef = useRef(null);
  const selectedContact = contacts.find((c) => c.id === contactId);

  // Charger la liste de contacts une seule fois
  useEffect(() => {
    async function fetchContacts() {
      try {
        const { data } = await authApi.get('/auth/users');
        setContacts(data.users);
      } finally {
        setLoadingContacts(false);
      }
    }
    fetchContacts();
  }, []);

  // Connexion WebSocket une seule fois, pour toute la durée de vie de la page
  useEffect(() => {
    const socket = getSocket(session.accessToken);

    function handleReceive(data) {
      if (data.senderId !== contactId) return; // message d'une autre conversation, ignoré ici

      setMessages((prev) => [
        ...prev,
        {
          id: `${data.timestamp}`,
          mine: false,
          text: data.translatedText,
          lang: data.targetLang,
          originalText: data.text,
          originalLang: data.sourceLang,
        },
      ]);
    }

    socket.on('receive_message', handleReceive);

    return () => {
      socket.off('receive_message', handleReceive);
    };
  }, [contactId, session.accessToken]);

  // Charger l'historique à chaque changement de contact sélectionné
  useEffect(() => {
    if (!contactId) return;

    async function fetchHistory() {
      setLoadingHistory(true);
      setMessages([]);
      try {
        const { data } = await gatewayApi.get(`/messages/with/${contactId}`);
        const mapped = data.messages.map((m) => ({
          id: m.id,
          mine: m.sender_id === session.user.id,
          text: m.sender_id === session.user.id ? m.original_text : m.translated_text,
          lang: m.sender_id === session.user.id ? m.original_lang : m.translated_lang,
          originalText: m.original_text,
          originalLang: m.original_lang,
        }));
        setMessages(mapped);
      } finally {
        setLoadingHistory(false);
      }
    }
    fetchHistory();
  }, [contactId, session.user.id]);

  // Scroll automatique vers le bas à chaque nouveau message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSelect(contact) {
    navigate(`/chat/${contact.id}`);
  }

  function handleLogout() {
    disconnectSocket();
    clearSession();
    navigate('/');
  }

  function handleSend(e) {
    e.preventDefault();
    if (!draft.trim() || !contactId) return;

    const socket = getSocket(session.accessToken);
    const sourceLang = session.user.preferred_language;

    socket.emit('send_message', {
      recipientId: contactId,
      text: draft,
      sourceLang,
    });

    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        mine: true,
        text: draft,
        lang: sourceLang,
      },
    ]);

    setDraft('');
  }

  return (
    <div className="flex h-screen bg-bg">
      <ContactList contacts={contacts} selectedId={contactId} onSelect={handleSelect} />

      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
          <div>
            <p className="text-sm text-text-muted">Connecté en tant que</p>
            <p className="text-text font-medium">{session?.user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-text-muted border border-border px-3 py-1.5 rounded-md"
          >
            Se déconnecter
          </button>
        </div>

        {!selectedContact && !loadingContacts && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-text-muted">Sélectionne un contact pour démarrer une conversation.</p>
          </div>
        )}

        {selectedContact && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingHistory && <p className="text-text-muted text-sm">Chargement de l'historique...</p>}
              {!loadingHistory && messages.length === 0 && (
                <p className="text-text-muted text-sm">Aucun message pour l'instant. Écris le premier.</p>
              )}
              {messages.map((m) => (
                <MessageBubble key={m.id} {...m} />
              ))}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSend} className="border-t border-border bg-surface px-6 py-4 flex gap-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Écris un message..."
                className="flex-1 border border-border rounded-md px-3 py-2 bg-bg text-text focus:outline-none focus:border-sky-strong"
              />
              <button
                type="submit"
                className="bg-sky-strong text-white px-5 py-2 rounded-md font-medium"
              >
                Envoyer
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default ChatPage;