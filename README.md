# Splitwise - Expense Splitting App

A React Native mobile application for managing shared expenses and splitting bills with friends and groups. Built with Expo, Firebase, and modern React Native patterns.

## 📱 App Overview

Splitwise is a feature-rich expense management application that simplifies tracking shared expenses, calculating who owes whom, and settling up debts. Perfect for roommates, travel groups, family events, or any situation where expenses are shared.

**Status**: In Development
**Platform**: iOS, Android (via Expo)
**Version**: 1.0.0

---

## ✨ Key Features

### 💰 Expense Management
- **Add Expenses**: Create expenses and split them among group members
- **Multiple Split Types**: Support for equal splits, custom amounts, and percentage-based splits
- **Expense Categories**: Organize expenses by type for better tracking
- **Edit & Delete**: Modify or remove expenses from history
- **Receipt Tracking**: Attach notes and details to expenses

### 👥 Group Management
- **Create Groups**: Organize expenses into groups (e.g., "Apartment", "Trip to Vegas")
- **Group Members**: Add/remove members from groups
- **Group Balances**: See who owes what within each group
- **Group History**: View complete expense history within a group
- **Group Details**: Access group settings and member information

### 👨‍👩‍👧 Friends & Balances
- **Friends List**: Maintain a contact list of people you share expenses with
- **Net Balances**: See net balance with each friend across all groups
- **Balance Summary**: Quick overview of total amount you owe/are owed
- **Individual Settlements**: Track balances between specific friends

### 💳 Multi-Currency Support
- **Global Currency Selection**: Choose from multiple currencies (INR, USD, EUR, GBP, etc.)
- **Currency Conversion**: Track expenses in different currencies
- **Default Currency Detection**: Automatically detects device locale and sets default currency
- **Per-Expense Currency**: Support for specifying currency per transaction

### 📊 Activity & History
- **Activity Feed**: Chronological log of all expenses and settlements
- **Transaction Details**: View full details of any transaction
- **Filter & Search**: Find specific transactions easily
- **Export History**: Track who paid whom and when

### ✅ Settle Up
- **Settlement Suggestions**: Get recommended payment instructions to settle all debts
- **Optimized Settlements**: Minimizes the number of transactions needed
- **Settlement History**: Track all completed settlements
- **Mark as Paid**: Record when payments are made

### 👤 User Profile
- **User Information**: Manage profile details
- **Authentication**: Secure login via Google
- **Session Management**: Logout and account control
- **Preferences**: Customize app settings

### 📱 Additional Features
- **Demo Data**: Pre-populated sample data for testing
- **Persistent Storage**: All data saved locally with Firebase backup
- **Responsive UI**: Optimized for various screen sizes
- **Bottom Tab Navigation**: Easy access to main sections

---

## 🎯 App Screens

### Tab Navigation (Main Screens)

#### 1. **Home Screen**
- Overview of recent expenses
- Quick balance summary
- Net balance with friends
- Quick actions (Add Expense, Settle Up)
- Recent activity preview
- Total owed/owing balance

#### 2. **Groups Screen**
- List of all expense groups
- Group summaries (member count, balance)
- Create new group
- Access group details
- See group-specific balances

#### 3. **Friends Screen**
- Complete friends list
- Individual net balances with each friend
- Add new friends
- View friend details
- Filter and search friends

#### 4. **Activity Screen**
- Chronological feed of all transactions
- All expenses and settlements
- Filter by type (expense, settlement)
- View transaction details
- Search through activity history

### Stack Navigation (Secondary Screens)

#### 5. **Authentication Screen**
- Google Sign-In integration
- Secure login/logout
- User registration
- OAuth flow handling

#### 6. **Group Detail Screen**
- Detailed group information
- List of group members with their balances
- Group expense history
- Member-wise split breakdown
- Edit/delete group option
- Group settlement status

#### 7. **Add Expense Screen**
- Expense amount input
- Category selection
- Date picker
- Description/notes
- Split method selection:
  - Equal split among members
  - Custom amount split
  - Percentage-based split
- Select who paid (payer)
- Select involved members
- Mark as settled
- Save and submit

#### 8. **Settle Up Screen**
- Settlement instructions display
- Optimized payment flow
- Who should pay whom
- Settlement history
- Mark settlement as complete
- Undo settlements

#### 9. **Profile Screen**
- User information display
- Account settings
- Logout option
- User preferences
- Edit profile details

#### 10. **Currency Screen**
- Available currencies list
- Current selection indicator
- Search currencies
- Change currency preference
- Conversion rate information

---

## 🛠 Tech Stack

### Frontend
- **React Native** (0.83.2) - Mobile framework
- **Expo** (55.0.8) - Development platform and build system
- **React** (19.2.0) - UI library
- **React Navigation** (7.x) - Navigation management
  - Stack Navigator
  - Bottom Tab Navigator

### Styling & UI
- **React Native Paper** (5.15.0) - Material Design components
- **Expo Vector Icons** (15.1.1) - Icon library (Ionicons)
- **Expo Linear Gradient** (55.0.9) - Gradient components
- **React Native Reanimated** (4.2.1) - Animations

### State Management & Storage
- **React Context API** - Global state management
- **AsyncStorage** (2.2.0) - Local data persistence
- **Firebase** (12.11.0) - Backend and authentication

### Native Features
- **Expo Contacts** (55.0.9) - Access device contacts
- **Expo Image Picker** (55.0.13) - Photo selection
- **Expo Auth Session** (55.0.9) - OAuth authentication
- **Expo Secure Store** (55.0.9) - Secure credential storage
- **Expo Web Browser** (55.0.10) - In-app browser

### Utilities
- **UUID** (13.0.0) - Unique identifier generation
- **React Native Gesture Handler** (2.30.0) - Gesture recognition
- **React Native Safe Area Context** (5.6.2) - Safe area handling
- **React Native Screens** (4.23.0) - Native screen components

---

## 📁 Project Structure

```
splitwise/
├── App.js                           # App entry point
├── index.js                         # React Native entry point
├── package.json                     # Dependencies configuration
├── app.json                         # Expo app configuration
├── babel.config.js                  # Babel configuration
│
├── src/
│   ├── context/
│   │   └── AppContext.js            # Global state management
│   │
│   ├── navigation/
│   │   └── AppNavigator.js          # Navigation structure and setup
│   │
│   ├── screens/                     # Screen components
│   │   ├── HomeScreen.js            # Home/Dashboard
│   │   ├── GroupsScreen.js          # Groups list
│   │   ├── GroupDetailScreen.js     # Group details
│   │   ├── FriendsScreen.js         # Friends list
│   │   ├── ActivityScreen.js        # Activity feed
│   │   ├── AddExpenseScreen.js      # Expense creation
│   │   ├── SettleUpScreen.js        # Settlement management
│   │   ├── ProfileScreen.js         # User profile
│   │   ├── CurrencyScreen.js        # Currency selector
│   │   └── AuthScreen.js            # Authentication
│   │
│   ├── components/                  # Reusable components
│   │   ├── Avatar.js                # User avatar component
│   │   └── BalanceSummary.js        # Balance display component
│   │
│   ├── services/                    # Business logic & API calls
│   │   ├── storage.js               # Data persistence (AsyncStorage/Firebase)
│   │   ├── firebase.js              # Firebase configuration
│   │   ├── googleAuth.js            # Google OAuth implementation
│   │   ├── currency.js              # Currency conversion & management
│   │   ├── contacts.js              # Device contacts access
│   │   └── (other services)
│   │
│   ├── utils/
│   │   └── splitCalculator.js       # Expense split calculation logic
│   │
│   └── constants/
│       └── colors.js                # Color palette and theme
│
└── assets/                          # App icons and splash screen
    ├── icon.png
    ├── splash-icon.png
    ├── favicon.png
    └── (Android icons)
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v16 or later) and **npm** or **yarn**
- **Expo CLI** installed globally
- **iOS Simulator** (Mac only) or **Android Emulator**
- **Google OAuth credentials** (for authentication)
- **Firebase project** (for backend services)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/splitwise.git
   cd splitwise
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure Firebase**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Copy your Firebase config
   - Update `src/services/firebase.js` with your config:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```

4. **Configure Google OAuth**
   - Set up Google OAuth at [Google Cloud Console](https://console.cloud.google.com)
   - Add OAuth redirect URIs (Expo will provide the URL)
   - Update `src/services/googleAuth.js` with your client ID

5. **Start the development server**
   ```bash
   npm start
   # or
   yarn start
   ```

---

## 📱 Running on Devices

### iOS Simulator
```bash
npm run ios
# or press 'i' in the Expo CLI
```

### Android Emulator
```bash
npm run android
# or press 'a' in the Expo CLI
```

### Web (Development only)
```bash
npm run web
# or press 'w' in the Expo CLI
```

### Physical Device via Expo Go
1. Install Expo Go app on your phone (iOS App Store / Google Play Store)
2. Run `npm start` in your terminal
3. Scan the QR code with your phone camera
4. Open the link in Expo Go

---

## 🔐 Authentication

### Google Sign-In
- Uses OAuth 2.0 with Google
- Credentials stored securely in Expo Secure Store
- Session persistence via AsyncStorage
- Automatic token refresh

### User Data
- User profile stored locally and in Firebase
- Email and ID used as unique identifier
- Avatar and basic info cached locally

---

## 💾 Data Management

### Local Storage
- **AsyncStorage**: Primary storage for app data
- **Expo Secure Store**: Sensitive credentials (tokens)
- Automatic persistence on app close

### Firebase Services (Planned)
- Firestore for data sync
- Fire Authentication for production
- Real-time database for multi-device sync

### Data Structures

**Expense Object**
```javascript
{
  id: "uuid",
  groupId: "group-uuid",
  paidBy: "user-id",
  amount: 1000,
  currency: "INR",
  category: "food",
  description: "Pizza for group",
  splits: [
    { userId: "user1", amount: 250 },
    { userId: "user2", amount: 250 },
    { userId: "user3", amount: 500 }
  ],
  date: "2024-03-19T10:30:00Z",
  settled: false
}
```

**Group Object**
```javascript
{
  id: "uuid",
  name: "Apartment",
  members: ["user1", "user2", "user3"],
  createdBy: "user-id",
  createdAt: "2024-03-01T10:00:00Z",
  expenses: ["expense-id-1", "expense-id-2"]
}
```

**User Object**
```javascript
{
  id: "firebase-user-id",
  name: "John Doe",
  email: "john@example.com",
  avatar: "avatar-url",
  currency: "INR",
  createdAt: "2024-01-01T00:00:00Z"
}
```

---

## 🧮 Core Features Implementation

### Split Calculator
Located in `src/utils/splitCalculator.js`

- Equal splits among members
- Custom amount splits
- Percentage-based splits
- Rounding handling for currency
- Balance calculation algorithms

### Balance Calculation
- Net balance tracking between users
- Group-wise balance calculation
- Settlement optimization algorithm
- Multi-group balance aggregation

### Currency Support
- Multiple currency selection
- Locale-based default currency detection
- Currency-specific formatting
- Exchange rate ready (future implementation)

---

## 🔄 State Management

### App Context (src/context/AppContext.js)
Global state includes:
- **user**: Current logged-in user
- **groups**: All user's groups
- **friends**: All user's friends
- **balances**: Current balances
- **activity**: Activity feed
- **currency**: Selected currency
- **loading**: App initialization state

### Available Actions
- `loginUser()` - Google authentication
- `logoutUser()` - Clear session
- `addExpense()` - Create new expense
- `createGroup()` - Create new group
- `addFriend()` - Add to contacts
- `settleBalance()` - Record payment
- `refresh()` - Refresh all data

---

## 🎨 UI/UX Design

### Colors (src/constants/colors.js)
- **Primary**: Action buttons and highlights
- **Secondary**: Alternative accent color
- **Success**: Positive states
- **Warning**: Caution states
- **Danger**: Destructive actions
- **Background**: App background
- **Surface**: Card backgrounds
- **Text**: Primary text color
- **TextMuted**: Secondary/disabled text
- **Border**: Divider lines

### Navigation Style
- **Bottom Tab Navigation**: Primary navigation
- **Stack Navigation**: Secondary screens
- **Modal Presentations**: Overlay screens
- **Consistent Headers**: Unified navigation experience

---

## 🐛 Known Issues & Limitations

- Real-time sync with Firebase not yet implemented
- Offline mode limited to local data only
- No image attachment for receipts yet
- Currency conversion rates are static (future enhancement)
- No push notifications for settlements
- Limited to 100 friends in display (pagination needed)

---

## 🚧 Future Enhancements

- [ ] Real-time Firebase sync
- [ ] Photo receipt attachment
- [ ] Expense categories with images
- [ ] Dark mode support
- [ ] Multi-language support (i18n)
- [ ] Payment gateway integration (Stripe, PayPal)
- [ ] Push notifications
- [ ] Advanced analytics and reports
- [ ] Recurring expense support
- [ ] Split request feature (ask for payment)
- [ ] Group chat/comments on expenses
- [ ] Export to PDF/CSV
- [ ] Web app version

---

## 📝 Usage Examples

### Adding an Expense
1. Go to Home screen
2. Tap "Add Expense" button
3. Enter amount and description
4. Select who paid
5. Select group members involved
6. Choose split method (equal, custom, percentage)
7. Confirm and save

### Creating a Group
1. Go to Groups screen
2. Tap "Create Group" button
3. Enter group name
4. Add members from contacts
5. Create group

### Settling Up
1. Go to Home screen or Activity
2. View pending settlements
3. Tap "Settle Up"
4. Follow settlement instructions
5. Mark as paid once transaction complete

---

## 🧪 Testing

### Pre-populated Demo Data
The app includes demo data for testing:
- Sample users and groups
- Pre-created expenses
- Various split types
- Settlement examples

Load demo data by checking `AppContext.js` seeding on app startup.

### Manual Testing Checklist
- [ ] User login/logout works
- [ ] Expenses can be added/edited/deleted
- [ ] Splits calculate correctly
- [ ] Balances update accurately
- [ ] Groups can be created and managed
- [ ] Friends can be added
- [ ] Currency can be changed
- [ ] Activity feed displays correctly
- [ ] Settle Up calculates optimal payments
- [ ] Data persists across app restarts

---

## 🔒 Security

### Authentication
- Google OAuth 2.0 for secure login
- No passwords stored locally
- Secure token storage using Expo Secure Store

### Data Privacy
- User data only shared with authenticated users
- No analytics or telemetry
- No third-party tracking
- Local data never leaves device without user consent

### Best Practices
- Input validation on all forms
- Error handling for API failures
- Secure error messages (no sensitive data in logs)
- Session timeout recommendations

---

## 📄 License

This project is private and confidential. All rights reserved.

---

## 👤 Author

Created by: Ajay Singh
Repository: Private GitHub Repository

---

## 📞 Support

For issues, feature requests, or questions:
1. Check existing issues in the private repo
2. Create a new issue with detailed description
3. Include device model, OS version, and reproduction steps
4. Attach relevant screenshots or logs

---

## 🤝 Contributing

This is a private project. For collaboration:
1. Ensure you have access to the private repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request for review

---

## 📚 Resources

### Documentation
- [React Native Docs](https://reactnative.dev)
- [Expo Documentation](https://docs.expo.dev)
- [React Navigation Guide](https://reactnavigation.org)
- [Firebase Documentation](https://firebase.google.com/docs)

### Tutorial References
- [Building Apps with React Native and Expo](https://docs.expo.dev/tutorial/build-a-todo-app/)
- [Firebase in React Native](https://firebase.google.com/docs/database/usage/app-support)
- [Navigation Patterns](https://reactnavigation.org/docs/tab-based-navigation)

---

## ✅ Changelog

### Version 1.0.0 (Initial Release)
- Core expense tracking functionality
- Group and friend management
- Multi-currency support
- Activity feed
- Settle Up feature
- Google OAuth authentication
- Local data persistence
- Bottom tab navigation

---

**Last Updated**: March 19, 2024
**Status**: In Development - Ready for Testing
